const { execSync } = require('child_process');

console.log("==================================================");
console.log("     SYSTEM-LEVEL ADGUARD DNS TESTER SCRIPT       ");
console.log("==================================================");

function getAdapters() {
    const stdout = execSync('powershell -Command "Get-NetAdapter -Physical | Where-Object Status -eq \'Up\' | Select-Object -ExpandProperty Name"').toString();
    return stdout.trim().split("\n").map(l => l.trim()).filter(Boolean);
}

function getDNS(adapter) {
    const stdout = execSync(`powershell -Command "(Get-DnsClientServerAddress -InterfaceAlias '${adapter}' -AddressFamily IPv4).ServerAddresses"`).toString();
    return stdout.trim().split("\n").map(l => l.trim()).filter(Boolean);
}

const adapters = getAdapters();
if (adapters.length === 0) {
    console.log("❌ No active physical network adapters found.");
    process.exit(1);
}

const targetAdapter = adapters[0];
console.log(`\n✅ Found target active network interface: ${targetAdapter}`);

console.log(`\n[1] Checking current DNS parameters...`);
let currentDns = getDNS(targetAdapter);
console.log(`    -> Current DNS: ${currentDns.length > 0 ? currentDns.join(", ") : "DHCP/Default"}`);

console.log(`\n[2] Engaging AdGuard DNS via Powershell (NO Admin Required)...`);
execSync(`powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${targetAdapter}' -ServerAddresses '94.140.14.14','94.140.15.15','2a10:50c0::ad1:ff','2a10:50c0::ad2:ff'"`);

let newDns = getDNS(targetAdapter);
if (newDns.includes("94.140.14.14") || newDns.includes("2a10:50c0::ad1:ff")) {
    console.log(`    -> ✅ BOUND SUCCESSFULLY: System DNS is now routed to AdGuard ${newDns.join(", ")}`);
} else {
    console.log(`    -> ❌ Failed to bind AdGuard.`);
}

console.log(`\n[3] Testing Ad-block capability against Google Doubleclick endpoints...`);
fetch('http://googleads.g.doubleclick.net')
    .then(r => console.log(`    -> ❌ SYSTEM UNPROTECTED! Connection leaked to ad server. Status: ${r.status}`))
    .catch(e => {
        if (e.message === 'fetch failed') {
            console.log(`    -> ✅ NATIVE SYSTEM PROTECTED! The OS successfully rejected the connection to the Ad Server.`);
        } else {
            console.log(`    -> ✅ PROTECTED (Error: ${e.message})`);
        }
    })
    .finally(() => {
        console.log(`\n[4] Restoring original adapter defaults...`);
        execSync(`powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${targetAdapter}' -ResetServerAddresses"`);
        console.log(`    -> ✅ Adapter restored natively.\n`);
    });
