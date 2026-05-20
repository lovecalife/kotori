$port = 3333
$root = Split-Path $PSScriptRoot -Parent

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Serving $root on http://localhost:$port/"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $reqPath = $ctx.Request.Url.LocalPath
    if ($reqPath -eq '/') { $reqPath = '/index.html' }

    $filePath = Join-Path $root ($reqPath.TrimStart('/').Replace('/', '\'))

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($filePath).ToLower()
        $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($filePath)
        $ctx.Response.ContentType = $mime
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $ctx.Response.StatusCode = 200
    } else {
        $ctx.Response.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes("Not found: $reqPath")
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $ctx.Response.Close()
}
