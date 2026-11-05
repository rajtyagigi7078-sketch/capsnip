param(
  [string]$Ffmpeg = 'C:\Users\yuvra\AppData\Local\Snip AI\windows-runtime\ffmpeg\ffmpeg.exe',
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'
$env:FONTCONFIG_FILE = Join-Path $ProjectRoot 'assets\fonts.conf'
$env:FONTCONFIG_PATH = Join-Path $ProjectRoot 'assets'
$styles = @(
  @{slug='video-fill-impact';font='impact.ttf';size=78},
  @{slug='video-fill-arial-black';font='ariblk.ttf';size=72},
  @{slug='video-fill-haettenschweiler';font='HATTEN.TTF';size=86},
  @{slug='video-fill-franklin-heavy';font='FRAHV.TTF';size=70},
  @{slug='video-fill-gill-ultra';font='GILLUBCD.TTF';size=64},
  @{slug='video-fill-rockwell-extra-bold';font='ROCKEB.TTF';size=68},
  @{slug='video-fill-cooper-black';font='COOPBL.TTF';size=70},
  @{slug='video-fill-agency-block';font='AGENCYB.TTF';size=78},
  @{slug='video-fill-bahnschrift';font='bahnschrift.ttf';size=72},
  @{slug='video-fill-tw-cen-condensed';font='TCBI____.TTF';size=82},
  @{slug='video-fill-eras-bold';font='ERASBD.TTF';size=72},
  @{slug='video-fill-britannic-bold';font='BRITANIC.TTF';size=72}
)
$fillDir = Join-Path $ProjectRoot 'assets\motion-fill'
$outputDir = Join-Path $ProjectRoot 'assets\caption-preview-loops-v2'
$tempText = Join-Path $env:TEMP 'capsnip-motion-preview-mask.txt'
[IO.File]::WriteAllText($tempText, "THIS IS SNIP`nAI", [Text.UTF8Encoding]::new($false))
Push-Location $env:TEMP
try {
  for ($i = 0; $i -lt $styles.Count; $i++) {
    $style = $styles[$i]
    $n = $i + 1
    $font = "C\:/Windows/Fonts/$($style.font)"
    $size = $style.size
    $source = Join-Path $fillDir ("motion-fill-{0:D2}.mp4" -f $n)
    $target = Join-Path $outputDir ("{0:D2}-{1}.mp4" -f (35 + $n), $style.slug)
    $mask = "color=black:s=640x360:r=30:d=2.2,drawtext=fontfile='$font':text='THIS IS SNIP':fontcolor=white:fontsize=$($size):x=(w-text_w)/2:y=108,drawtext=fontfile='$font':text='AI':fontcolor=white:fontsize=$($size):x=(w-text_w)/2:y=205[mask]"
    $graph = "[0:v]scale=640:360:force_original_aspect_ratio=increase,crop=640:360,fps=30,setsar=1[fill];$mask;[fill][mask]alphamerge[masked];color=c=black:s=640x360:r=30:d=2.2[bg];[bg][masked]overlay=shortest=1:format=auto[v]"
    & $Ffmpeg -hide_banner -loglevel error -filter_complex_threads 1 -i $source -filter_complex $graph -map '[v]' -an -t 2.2 -c:v libx264 -preset veryfast -crf 29 -pix_fmt yuv420p -movflags +faststart $target -y
    if ($LASTEXITCODE -ne 0) { throw "Failed to render $($style.slug)" }
    Write-Output "[$n/12] $($style.slug)"
  }
} finally { Pop-Location }

