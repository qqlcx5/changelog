# sync-index.ps1 - consistency gate for the changelog knowledge base
# Mode 1 (default): validate frontmatter + INDEX.md consistency; exit 1 on errors.
# Mode 2 (-Sync):   regenerate INDEX.md table blocks from file frontmatter (files are the source of truth).
# Requires PowerShell 5.1+; resolves repo root from this script's location (tools/).
param([switch]$Sync)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$repo = Split-Path -Parent $PSScriptRoot
$indexFile = Join-Path $repo 'INDEX.md'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$errors = @()

function Read-Text([string]$p) { [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) }
function Write-Text([string]$p, [string]$t) { [System.IO.File]::WriteAllText($p, $t, $script:utf8NoBom) }

# ---------- 1. collect & validate single-file entries (prompts/ + playbooks/) ----------
$required = @('id','type','title','tags','status','source','created','updated')
$idPattern = '^(PR|PB)-\d{8}-\d{3}$'
$datePattern = '^\d{4}-\d{2}-\d{2}$'
$validStatus = @('draft','verified','promoted')
$prefixByType = @{ prompt = 'PR'; playbook = 'PB' }
$entries = @()
$seenIds = @{}

foreach ($pair in @(@('prompts','prompt'), @('playbooks','playbook'))) {
    $dir = $pair[0]; $type = $pair[1]
    $dirPath = Join-Path $repo $dir
    if (-not (Test-Path $dirPath)) { $errors += "MISSING-DIR: $dir/"; continue }
    foreach ($f in (Get-ChildItem $dirPath -Filter '*.md' | Sort-Object Name)) {
        $rel = "$dir/$($f.Name)"
        $text = Read-Text $f.FullName
        if ($text -notmatch '(?s)^---\r?\n(.*?)\r?\n---') { $errors += "NO-FRONTMATTER: $rel"; continue }
        $h = @{}
        foreach ($line in ($Matches[1] -split "\r?\n")) {
            if ($line -match '^([A-Za-z_]+):\s*(.*)$') { $h[$Matches[1]] = $Matches[2].Trim() }
        }
        $id=''; $etype=''; $title=''; $status=''; $created=''; $updated=''
        foreach ($k in $required) {
            if (-not ($h.ContainsKey($k) -and $h[$k])) { $errors += "MISSING-FIELD: $rel -> $k" }
        }
        if ($h.ContainsKey('id'))     { $id = $h['id'] }
        if ($h.ContainsKey('type'))   { $etype = $h['type'] }
        if ($h.ContainsKey('title'))  { $title = $h['title'] }
        if ($h.ContainsKey('status')) { $status = $h['status'] }
        if ($h.ContainsKey('created')){ $created = $h['created'] }
        if ($h.ContainsKey('updated')){ $updated = $h['updated'] }
        if ($id) {
            if ($id -notmatch $idPattern) { $errors += "BAD-ID: $rel -> $id" }
            else {
                if ($id.Split('-')[0] -ne $prefixByType[$type]) { $errors += "ID-TYPE-MISMATCH: $rel -> $id under $dir/" }
                if ($seenIds.ContainsKey($id)) { $errors += "DUP-ID: $id ($rel vs $($seenIds[$id]))" } else { $seenIds[$id] = $rel }
            }
        }
        if ($etype -and $etype -ne $type) { $errors += "TYPE-DIR-MISMATCH: $rel -> type=$etype" }
        if ($status -and $validStatus -notcontains $status) { $errors += "BAD-STATUS: $rel -> $status" }
        if ($created -and $created -notmatch $datePattern) { $errors += "BAD-DATE: $rel -> created=$created" }
        if ($updated -and $updated -notmatch $datePattern) { $errors += "BAD-DATE: $rel -> updated=$updated" }
        $tags = ''
        if ($h.ContainsKey('tags')) { $tags = $h['tags'] -replace '^\[|\]$', '' -replace '\s', '' }
        $entries += [pscustomobject]@{ Id = $id; Type = $type; Title = $title; Status = $status; Tags = $tags; Updated = $updated; Path = $rel }
    }
}

# ---------- 2. learnings tracks ----------
$tracks = @(
    @{ Name = 'errors';           File = 'ERRORS.md';           Prefix = 'ERR'  },
    @{ Name = 'learnings';        File = 'LEARNINGS.md';        Prefix = 'LRN'  },
    @{ Name = 'feature-requests'; File = 'FEATURE_REQUESTS.md'; Prefix = 'FEAT' }
)
$trackStats = @()
foreach ($t in $tracks) {
    $p = Join-Path $repo "learnings\$($t.File)"
    if (-not (Test-Path $p)) { $errors += "MISSING-TRACK-FILE: learnings/$($t.File)"; continue }
    $count = ([regex]::Matches((Read-Text $p), "(?m)^## \[$($t.Prefix)-")).Count
    $trackStats += [pscustomobject]@{ Name = $t.Name; File = "learnings/$($t.File)"; Count = $count; Updated = (Get-Item $p).LastWriteTime.ToString('yyyy-MM-dd') }
}

# ---------- 3. INDEX.md block helpers ----------
function Get-Block([string]$text, [string]$name) {
    if ($text -match "(?s)<!-- BEGIN:$name -->\r?\n(.*?)<!-- END:$name -->") { return $Matches[1] } else { return $null }
}
function Set-Block([string]$text, [string]$name, [string]$inner) {
    $pattern = "(?s)<!-- BEGIN:$name -->\r?\n.*?<!-- END:$name -->"
    $newBlock = "<!-- BEGIN:$name -->`r`n" + $inner + "<!-- END:$name -->"
    return [regex]::Replace($text, $pattern, { param($m) $newBlock })
}
function Parse-TableRows([string]$block) {
    $rows = @()
    foreach ($line in ($block -split "\r?\n")) {
        if ($line -match '^\|(.+)\|\s*$') {
            $cells = ($Matches[1] -split '\|') | ForEach-Object { $_.Trim() }
            if ($cells.Count -ge 4 -and $cells[0] -ne 'id' -and $cells[0] -ne 'track' -and $cells[0] -notmatch '^-+$') { $rows += ,@($cells) }
        }
    }
    return ,$rows
}

# ---------- 4. -Sync mode: regenerate blocks, then re-validate ----------
if ($Sync) {
    if (-not (Test-Path $indexFile)) { Write-Host 'FAILED: INDEX.md not found'; exit 1 }
    $indexText = Read-Text $indexFile
    $tableByBlock = @{ prompts = 'prompt'; playbooks = 'playbook' }
    foreach ($blockName in @('prompts','playbooks')) {
        $type = $tableByBlock[$blockName]
        $lines = @('| id | title | status | tags | updated | path |', '|---|---|---|---|---|---|')
        foreach ($e in ($entries | Where-Object { $_.Type -eq $type } | Sort-Object Id)) {
            $lines += "| $($e.Id) | $($e.Title) | $($e.Status) | $($e.Tags) | $($e.Updated) | $($e.Path) |"
        }
        $indexText = Set-Block $indexText $blockName (($lines -join "`r`n") + "`r`n")
    }
    $lLines = @('| track | file | entries | updated |', '|---|---|---|---|')
    foreach ($s in ($trackStats | Sort-Object Name)) { $lLines += "| $($s.Name) | $($s.File) | $($s.Count) | $($s.Updated) |" }
    $indexText = Set-Block $indexText 'learnings' (($lLines -join "`r`n") + "`r`n")
    Write-Text $indexFile $indexText
    Write-Host "SYNCED: INDEX.md regenerated from frontmatter ($(@($entries).Count) entries)."
    # fall through to validation below
    $errors = @()
}

# ---------- 5. validation mode ----------
if (-not (Test-Path $indexFile)) { Write-Host 'FAILED: INDEX.md not found'; exit 1 }
$indexText = Read-Text $indexFile

foreach ($pair in @(@('prompts','prompt'), @('playbooks','playbook'))) {
    $blockName = $pair[0]; $type = $pair[1]
    $block = Get-Block $indexText $blockName
    if ($null -eq $block) { $errors += "MISSING-BLOCK: $blockName"; continue }
    $rows = Parse-TableRows $block
    $byPath = @{}
    foreach ($r in $rows) { $byPath[$r[5]] = $r }
    foreach ($e in ($entries | Where-Object { $_.Type -eq $type })) {
        if (-not $byPath.ContainsKey($e.Path)) { $errors += "INDEX-MISSING-ROW: $($e.Path)"; continue }
        $r = $byPath[$e.Path]
        if ($r[0] -ne $e.Id)      { $errors += "INDEX-DRIFT: $($e.Path) id '$($r[0])' != '$($e.Id)'" }
        if ($r[1] -ne $e.Title)   { $errors += "INDEX-DRIFT: $($e.Path) title mismatch" }
        if ($r[2] -ne $e.Status)  { $errors += "INDEX-DRIFT: $($e.Path) status '$($r[2])' != '$($e.Status)'" }
        if ($r[3] -ne $e.Tags)    { $errors += "INDEX-DRIFT: $($e.Path) tags '$($r[3])' != '$($e.Tags)'" }
        if ($r[4] -ne $e.Updated) { $errors += "INDEX-DRIFT: $($e.Path) updated '$($r[4])' != '$($e.Updated)'" }
    }
    $validPaths = @($entries | Where-Object { $_.Type -eq $type } | ForEach-Object { $_.Path })
    foreach ($r in $rows) { if ($validPaths -notcontains $r[5]) { $errors += "INDEX-ORPHAN-ROW: $($r[5])" } }
}

$block = Get-Block $indexText 'learnings'
if ($null -eq $block) { $errors += 'MISSING-BLOCK: learnings' }
else {
    $rows = Parse-TableRows $block
    foreach ($s in $trackStats) {
        $row = $rows | Where-Object { $_[1] -eq $s.File } | Select-Object -First 1
        if (-not $row) { $errors += "INDEX-MISSING-ROW: $($s.File)"; continue }
        if ("$($row[2])" -ne "$($s.Count)") { $errors += "INDEX-DRIFT: $($s.File) entries '$($row[2])' != actual $($s.Count)" }
    }
    foreach ($r in $rows) {
        $known = @($trackStats | ForEach-Object { $_.File })
        if ($known -notcontains $r[1]) { $errors += "INDEX-ORPHAN-ROW: $($r[1])" }
    }
}

if (@($errors).Count -gt 0) {
    Write-Host ("FAILED: {0} error(s)" -f @($errors).Count)
    foreach ($e in $errors) { Write-Host "  - $e" }
    exit 1
} else {
    $trackSummary = ($trackStats | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '
    Write-Host "OK: $(@($entries).Count) entries consistent; learnings [$trackSummary]"
    exit 0
}
