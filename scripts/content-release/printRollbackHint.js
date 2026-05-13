function printRollbackHint({ config, releaseId, backupDir }) {
  const sshTarget = `${config.sshUser}@${config.sshHost}`;
  const commands = [
    `ssh -i ${config.sshKey} ${sshTarget} "cp ${backupDir}/api/catalog.json ${config.remoteApiDir}/catalog.json"`,
    `ssh -i ${config.sshKey} ${sshTarget} "cp -r ${backupDir}/covers/. ${config.remoteStaticDir}/covers/"`,
    `ssh -i ${config.sshKey} ${sshTarget} "if [ -d ${backupDir}/audio ]; then cp -r ${backupDir}/audio/. ${config.remoteStaticDir}/audio/; fi"`
  ];

  console.error(`Rollback hint for ${releaseId}:`);
  for (const command of commands) {
    console.error(command);
  }
}

module.exports = {
  printRollbackHint
};
