const { exec } = require('node:child_process');
const { promisify } = require('node:util');

const execAsync = promisify(exec);

const ADGUARD_DNS = {
  ipv4: ['94.140.14.14', '94.140.15.15'],
  ipv6: ['2a10:50c0::ad1:ff', '2a10:50c0::ad2:ff']
};

async function run() {
  console.log('--- DNS TEST SCRIPT ---');
  try {
    // 1. Get adapters names that are 'Up'
    console.log('Checking for active adapters...');
    const { stdout: namesOut } = await execAsync('powershell -Command "Get-NetAdapter | Where-Object { $PSItem.Status -eq \'Up\' } | Select-Object -ExpandProperty Name"');
    
    if (!namesOut || namesOut.trim() === "") {
        console.error('No up adapters found');
        return;
    }
    const adapters = namesOut.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    console.log(`Found ${adapters.length} adapters: ${adapters.join(', ')}`);

    // 2. Prepare test command
    const allServers = [...ADGUARD_DNS.ipv4.map(s => `'${s}'`), ...ADGUARD_DNS.ipv6.map(s => `'${s}'`)].join(',');
    const testCmd = adapters.map(name => `Set-DnsClientServerAddress -InterfaceAlias '${name}' -ServerAddresses (${allServers})`).join('; ');

    console.log('Running DNS Change Command (Requires Admin):');
    console.log(`powershell -Command "${testCmd}"`);
    
    await execAsync(`powershell -Command "${testCmd}"`);
    console.log('SUCCESS: DNS changed!');

    // 3. Verify
    console.log('\n--- VERIFICATION ---');
    for (const name of adapters) {
        const { stdout: verify } = await execAsync(`powershell -Command "Get-DnsClientServerAddress -InterfaceAlias '${name}' | Select-Object -ExpandProperty ServerAddresses"`);
        console.log(`Adapter [${name}] DNS Servers:`);
        console.log(verify);
    }

    console.log('\n--- RESTORE COMMANDS ---');
    const restoreCmd = adapters.map(name => `Set-DnsClientServerAddress -InterfaceAlias '${name}' -ResetServerAddresses`).join('; ');
    console.log('To undo this, run:');
    console.log(`powershell -Command "${restoreCmd}"`);

  } catch (err) {
    console.error(`FAILURE: ${err.message}`);
    if (err.message.includes('Access is denied')) {
        console.error('\nNOTE: Make sure to run the terminal as ADMINISTRATOR!');
    }
  }
}

run();
