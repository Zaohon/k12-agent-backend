const { exec } = require('child_process');
exec('git status --short && git status --branch --short', { cwd: process.cwd() }, (err, stdout, stderr) => {
  if (err) {
    console.error('ERR', err.message);
    if (stderr) console.error('STDERR', stderr);
    process.exit(1);
  }
  console.log(stdout);
});
