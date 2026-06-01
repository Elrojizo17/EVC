param([string]$path = 'c:\Users\aleja\Desktop\Nueva carpeta\Documentación\Requisitos Luminarias.docx')
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($path)
$entry = $zip.GetEntry('word/document.xml')
$sr = New-Object System.IO.StreamReader($entry.Open())
$xml = $sr.ReadToEnd()
$sr.Close()
$zip.Dispose()
$xmlDoc = New-Object System.Xml.XmlDocument
$xmlDoc.LoadXml($xml)
$nsMgr = New-Object System.Xml.XmlNamespaceManager($xmlDoc.NameTable)
$nsMgr.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$paras = $xmlDoc.SelectNodes('//w:p',$nsMgr)
foreach ($p in $paras) {
  $texts = $p.SelectNodes('.//w:t',$nsMgr)
  if ($texts) {
     $arr = @()
     foreach ($t in $texts) { $arr += $t.InnerText }
     $line = $arr -join ''
     Write-Output $line
  }
}
