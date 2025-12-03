@echo off

if "%1" == "" (
  set mastermdb=%APPDATA%\..\LocalLow\Cygames\umamusume\master\master.mdb
) else (
  set mastermdb=%1
)

perl ../uma-skill-tools/tools/make_skill_data.pl %mastermdb% > skill_data.json
perl make_global_skillnames.pl %mastermdb% > skillnames.json
perl make_global_skill_meta.pl %mastermdb% > skill_meta.json
perl make_global_uma_info.pl %mastermdb%
node build.mjs
