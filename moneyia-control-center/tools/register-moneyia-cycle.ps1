param([int]$EveryMinutes = 30)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$taskName = 'MoneyIA-Python-Snapshot-30m'
$python = (Get-Command python.exe -ErrorAction Stop).Source
$arguments = "`"$root\tools\moneyia_automation.py`" cycle --with-email --prepare-queue --queue-limit 30"
$action = New-ScheduledTaskAction -Execute $python -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'MoneyIA: ciclo Python, e-mail somente leitura, relatório e preparação de até 30 propostas na Mesa; sem envio externo' -Force | Out-Null
Write-Output "registered=$taskName intervalMinutes=$EveryMinutes"
