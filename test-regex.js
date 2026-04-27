const THREAT_DB = {
  DANGEROUS_EXTENSIONS: [
    "exe", "msi", "bat", "cmd", "scr", "pif", "vbs", "vbe",
    "jse", "wsf", "wsc", "ps1", "psm1", "reg", "inf", "hta",
    "cpl", "sct",
  ]
};

const urlString = 'https://www.where-am-i.co/my-ip-locationgoogle_vignette.exe';
const urlLower = urlString.toLowerCase();

const dangerousExt = THREAT_DB.DANGEROUS_EXTENSIONS.find(ext => 
  urlLower.match(new RegExp(`\\.${ext}([/?#]|$)`))
);

console.log('Result:', dangerousExt);

const regexTest = new RegExp(`\\.${'exe'}([/?#]|$)`);
console.log('Regex:', regexTest);
console.log('Match:', urlLower.match(regexTest));