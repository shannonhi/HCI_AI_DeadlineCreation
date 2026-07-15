$backend  = Start-Process -NoNewWindow -PassThru powershell -ArgumentList "-Command", "venv\Scripts\python.exe -m uvicorn main:app --reload"
$frontend = Start-Process -NoNewWindow -PassThru powershell -ArgumentList "-Command", "cd frontend ; npm run dev"

Write-Host "Backend  → http://localhost:8000  (PID $($backend.Id))"
Write-Host "Frontend → http://localhost:5173  (PID $($frontend.Id))"
Write-Host "Press Ctrl+C to stop both..."

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    Stop-Process -Id $backend.Id  -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
}
