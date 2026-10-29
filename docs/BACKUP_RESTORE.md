# Backup and recovery
Local backups are on the same VPS. They do not survive total VPS loss, provider failure or storage compromise. Do not store irreplaceable customer data until an off-VPS independently recoverable encrypted copy exists.

Run `BACKUP_ROOT=/srv/metalflow/backups RETENTION_DAYS=14 infrastructure/scripts/backup.sh`. The script pauses API and worker writes, uses PostgreSQL custom-format pg_dump, archives protected assets and required configuration, checks archive readability, then resumes writers. Config includes secrets: files are private, never commit or publicly serve them. The supplied retention removes only timestamped backup directories under the configured backup root.

Optional daily schedule: `0 3 * * * cd /opt/metalflow/app && ./infrastructure/scripts/backup.sh`. No schedule is installed automatically. Copy completed backups to independent storage using an operator-approved encrypted transport.

Restore is destructive: use an isolated Compose project to rehearse first. `CONFIRM_RESTORE=YES infrastructure/scripts/restore.sh /srv/metalflow/backups/TIMESTAMP`. Restore the matching .env and proxy configuration manually from config.tgz when recovering a new machine, then run the restore script. Database and uploads are replaced; services remain stopped on a restore failure for investigation.

Verify organization counts, invoices, inventory balances, asset downloads and the health endpoint after restoration. Never restore production data into publicly accessible test workspaces.

AI credentials additionally require the exact AI_KEY_ENCRYPTION_KEY from the configuration backup. Database restoration without it cannot decrypt stored provider keys. Preserve and protect the matching configuration; never generate a replacement master key as a restore step.
