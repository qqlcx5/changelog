---
id: PB-20260904-004
type: playbook
title: Spring Boot 3 + MyBatis-Plus Service 纯 Mockito 单测方案（静态依赖注入 / lambda 列缓存 / surefire 硬编码跳测）
tags: [springboot3, mybatis-plus, unit-test, mockito]
status: verified
source: conversation:2026-09-04
created: 2026-09-04
updated: 2026-09-04
---

# Spring Boot 3 + MyBatis-Plus Service 纯 Mockito 单测方案

## 适用场景

- Service 层被测方法依赖 **hutool `SpringUtil.getBean(...)` 取 Bean 的静态工具**（如字典缓存工具类加载时 `private static CacheService cacheService = SpringUtil.getBean(CacheService.class)`、校验工具每次调用 `SpringUtil.getBean(Validator.class)`）。
- Service 继承 MyBatis-Plus `ServiceImpl`，方法内用 `lambdaQuery()` / `LambdaQueryChainWrapper`（依赖 TableInfo lambda 列缓存）。
- 父 pom 的 surefire 插件 `<configuration>` 里**硬编码** `<skipTests>true</skipTests>`。
- 目标：不起 Spring 上下文、不连数据库，纯 Mockito + JUnit 5 跑通 Service 业务校验逻辑（唯一性 / 乐观锁 / 审计保留 / 导入行号报错等）。

## 五个坑点与方案

### 1. 静态工具的 SpringUtil 依赖 → mock ApplicationContext 注入

`SpringUtil` 从 `applicationContext` 字段（或其 BeanFactory）取 Bean。mock 两级上下文并打桩**两条 getBean 路径**（静态字段初始化走 `context.getBeanFactory().getBean(...)`，实例方法调用走 `context.getBean(...)`）：

```java
private void injectStaticDependencies() {
    CacheService cacheService = mock(CacheService.class);
    // 字典缓存按类型全量预置（thenAnswer 按 field 取值，测试类间共享 JVM 也稳定）
    when(cacheService.hGet(eq(CACHE_KEY), any()))
            .thenAnswer(invocation -> dicts.get(invocation.getArgument(1)));
    Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
    ConfigurableListableBeanFactory beanFactory = mock(ConfigurableListableBeanFactory.class);
    when(beanFactory.getBean(CacheService.class)).thenReturn(cacheService);
    when(beanFactory.getBean(Validator.class)).thenReturn(validator);
    ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);
    when(context.getBeanFactory()).thenReturn(beanFactory);
    when(context.getBean(CacheService.class)).thenReturn(cacheService);
    when(context.getBean(Validator.class)).thenReturn(validator);
    ReflectionTestUtils.setField(SpringUtil.class, "applicationContext", context);
}
```

注意：静态工具的 `cacheService` 字段在**类加载时**初始化，若已被先前测试类加载过则拿到的是当时的 mock——字典桩必须 `thenAnswer` 返回全量 Map（按 field 名取），不能 `thenReturn` 局部数据，否则测试类执行顺序会互相影响。

### 2. MyBatis-Plus lambda 列缓存 → TableInfoHelper 预初始化

`LambdaQueryWrapper.eq(Entity::getXxx)` 需要 MP 内置的 lambda 列名缓存，纯单测无 MyBatis 启动过程会抛 `can not find lambda cache`。在 `@BeforeEach` 手动注册：

```java
TableInfoHelper.initTableInfo(
        new MapperBuilderAssistant(new MybatisConfiguration(), ""), Entity.class);
```

涉及的每个 Entity（含被 mock 的关联服务返回实体）都要注册一次。

### 3. Service 字段注入与跨服务 lambdaQuery

- `ServiceImpl.baseMapper` 是 protected 字段：`ReflectionTestUtils.setField(service, "baseMapper", mapper)`。
- 被测 Service 构造注入另一个业务 Service 且方法内调其 `lambdaQuery()`：

```java
ScmSupplierService scmSupplierService = mock(ScmSupplierService.class);
when(scmSupplierService.lambdaQuery()).thenAnswer(invocation ->
        new LambdaQueryChainWrapper<>(supplierMapper));
when(supplierMapper.selectList(any())).thenReturn(List.of(supplier("F001", "工厂A")));
```

链式调用最终落到 `supplierMapper.selectList`，桩这个即可。

### 4. EasyExcel 导入逻辑测试 → 内存写真实 xlsx + 走拒绝路径

```java
private MockMultipartFile excel(List<ImportDTO> rows) {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    EasyExcel.write(out).head(ImportDTO.class).sheet("数据").doWrite(rows);
    return new MockMultipartFile("file", "import.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());
}
```

- 用 `@ExcelProperty` 注解的 DTO 直接当表头，内存生成真实 xlsx，测「第N行 + 校验错误文案」断言。
- **走校验失败路径**（非法字典值 / 文件内重复 / 不存在外键）：整批回滚逻辑在 `saveBatch` 前抛出，避开 SqlSession 依赖；成功导入路径（需 `saveBatch`）留给集成/手动验收，不硬 mock。

### 5. surefire 硬编码 skipTests → 临时改 pom + 无痕还原

`<configuration><skipTests>true</skipTests></configuration>` 是**配置元素硬编码**，命令行 `-DskipTests=false` 无法覆盖（`-D` 只能覆盖属性引用 `${...}`）。唯一生效方式：

1. 临时把配置元素改为 `false`；
2. 跑 `mvn test`；
3. `git restore`（或手工）还原该行；
4. `git status -- <pom>` 验证无痕。

坑：IDE 侧暂存操作可能把「整行删掉」而非「改值」，还原后必须用 `git diff` 核对该文件与 HEAD 一致，不能只看改回的行。单文件同时还原暂存与工作区：

```powershell
git restore --source=HEAD --staged --worktree -- path/to/pom.xml
```

## 完整命令

```powershell
# 跑指定模块的单测（-am 解析兄弟模块 SNAPSHOT；failIfNoSpecifiedTests 让依赖模块无匹配测试时不失败）
mvn -q -o -pl <module> -am test "-Dtest=Xxx*Test" "-Dsurefire.failIfNoSpecifiedTests=false"

# 静默模式下确认真实执行数（防 "Tests are skipped" 假绿）
Get-ChildItem "<module>/target/surefire-reports" -Filter "*.txt" | ForEach-Object { Get-Content $_.FullName -TotalCount 4 }
```

## 验证结果（2026-09-04 实战）

两个 Service 单测 19/19 通过（Failures 0 / Errors 0）：唯一冲突拒绝、删除后重建、乐观锁、审计保留、供应商反查覆盖客户端篡改值、导入非法字典/文件内重复/空文件的行号报错，全程无 Spring 上下文与数据库。

## 常用断言套路

- 唯一冲突：`when(mapper.selectCount(any())).thenReturn(1L)` → `assertThrows` + 消息含冲突字段值 + `verify(mapper, never()).insert(any())`。
- 审计保留：`ArgumentCaptor` 捕获 `updateById` 入参，断言 `createById/createUserName/createTime` 与既有记录一致。
- 删除后重建：`selectCount` 默认桩 0 → 直接调用保存 → `verify(mapper, times(1)).insert(any())`（`@TableLogic` 在真实库过滤已删数据，单测层面以唯一预检通过为口径）。
