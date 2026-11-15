rm -f push-remove-emoji.sh apply-icon-fix.sh sync-update.sh MULTI_USER_CONNECTIVITY_REPORT.md fix-app-icon.sh generate-png-icon.js
git add -A
git commit -m "chore: remove redundant temporary helper scripts and non-essential reports"
git push origin main
