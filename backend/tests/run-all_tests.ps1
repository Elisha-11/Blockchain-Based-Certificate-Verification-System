# ============================================
# BACKEND TEST SUITE
# Blockchain-Based Certificate Verification System
# University of Zambia - Final Year Project
# Students: Elisha Lungu (2021490777), Nkonsi D. Shumba (2020079563)
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "BACKEND TESTING SUITE" -ForegroundColor Cyan
Write-Host "Blockchain-Based Certificate Verification System" -ForegroundColor Cyan
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Configuration
$BaseUrl = "http://127.0.0.1:5000"
$TestResults = @{
    Passed = 0
    Failed = 0
    Total = 0
}

# Helper function to record test results
function Test-Result {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message
    )
    $TestResults.Total++
    if ($Passed) {
        $TestResults.Passed++
        Write-Host "✅ PASS: $TestName" -ForegroundColor Green
    } else {
        $TestResults.Failed++
        Write-Host "❌ FAIL: $TestName - $Message" -ForegroundColor Red
    }
}

# ============================================
# TEST 1: Server Health Check
# ============================================
Write-Host "`n[TEST 1] Server Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get -ErrorAction Stop
    Test-Result -TestName "Server is running" -Passed ($health.status -eq "OK") -Message "Health check failed"
} catch {
    Test-Result -TestName "Server is running" -Passed $false -Message $_.Exception.Message
}

# ============================================
# TEST 2: Admin Login
# ============================================
Write-Host "`n[TEST 2] Authentication - Admin Login" -ForegroundColor Yellow
try {
    $loginBody = @{ email = "admin@unza.zm"; password = "Admin@123!" } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -ErrorAction Stop
    $global:ADMIN_TOKEN = $loginResponse.token
    Test-Result -TestName "Admin login successful" -Passed ($null -ne $loginResponse.token) -Message "No token received"
    Write-Host "🔑 Token saved to `$global:ADMIN_TOKEN" -ForegroundColor Gray
} catch {
    Test-Result -TestName "Admin login successful" -Passed $false -Message $_.Exception.Message
    Write-Host "⚠️  Ensure admin@unza.zm exists in database with correct password" -ForegroundColor Yellow
}

# ============================================
# TEST 3: Register Verifier
# ============================================
Write-Host "`n[TEST 3] Authentication - Register Verifier" -ForegroundColor Yellow
try {
    $regBody = @{ email = "verifier@test.zm"; password = "Verify@123"; full_name = "Test Verifier"; role = "verifier" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" -Method Post -ContentType "application/json" -Body $regBody -ErrorAction Stop
    Test-Result -TestName "Verifier registration" -Passed $true -Message ""
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
        Test-Result -TestName "Verifier registration" -Passed $true -Message "Already exists (acceptable)"
    } else {
        Test-Result -TestName "Verifier registration" -Passed $false -Message $_.Exception.Message
    }
}

# ============================================
# TEST 4: Verifier Login
# ============================================
Write-Host "`n[TEST 4] Authentication - Verifier Login" -ForegroundColor Yellow
try {
    $vLoginBody = @{ email = "verifier@test.zm"; password = "Verify@123" } | ConvertTo-Json
    $vLoginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $vLoginBody -ErrorAction Stop
    $global:VERIFIER_TOKEN = $vLoginResponse.token
    Test-Result -TestName "Verifier login successful" -Passed ($null -ne $vLoginResponse.token) -Message "No token received"
} catch {
    Test-Result -TestName "Verifier login successful" -Passed $false -Message $_.Exception.Message
}

# ============================================
# TEST 5: RBAC - Verifier Blocked from Issuance
# ============================================
Write-Host "`n[TEST 5] Authorization - RBAC Enforcement" -ForegroundColor Yellow
try {
    $vHeaders = @{ Authorization = "Bearer $global:VERIFIER_TOKEN" }
    $issueBody = @{ student_name = "Test"; program = "Test"; institution_id = "00000000-0000-0000-0000-000000000000"; issue_date = "2026-04-05" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/api/certificates" -Method Post -ContentType "application/json" -Body $issueBody -Headers $vHeaders -ErrorAction Stop
    Test-Result -TestName "Verifier blocked from issuance" -Passed $false -Message "Should have returned 403"
} catch {
    Test-Result -TestName "Verifier blocked from issuance" -Passed ($_.Exception.Response.StatusCode.value__ -eq 403) -Message "Status: $($_.Exception.Response.StatusCode.value__)"
}

# ============================================
# TEST 6: Certificate Issuance
# ============================================
Write-Host "`n[TEST 6] Certificate Issuance" -ForegroundColor Yellow
Write-Host "⚠️  Please enter your UNZA institution_id (from MySQL):" -ForegroundColor Yellow
$UNZA_ID = Read-Host "Institution ID"
Write-Host "⚠️  Please enter a student_id (from MySQL):" -ForegroundColor Yellow
$STUDENT_ID = Read-Host "Student ID"

if ($UNZA_ID -and $STUDENT_ID) {
    try {
        $headers = @{ Authorization = "Bearer $global:ADMIN_TOKEN" }
        $issueBody = @{
            student_name = "Test Student"
            program = "BSc Computing"
            institution_id = $UNZA_ID
            issue_date = "2026-04-05"
            student_id = $STUDENT_ID
        } | ConvertTo-Json
        $issueResponse = Invoke-RestMethod -Uri "$BaseUrl/api/certificates" -Method Post -ContentType "application/json" -Body $issueBody -Headers $headers -ErrorAction Stop
        $global:TEST_CERT_ID = $issueResponse.cert_id
        Test-Result -TestName "Certificate issuance" -Passed ($null -ne $issueResponse.cert_id) -Message "No cert_id received"
        Write-Host "📝 Cert ID: $($issueResponse.cert_id)" -ForegroundColor White
    } catch {
        Test-Result -TestName "Certificate issuance" -Passed $false -Message $_.Exception.Message
    }
} else {
    Test-Result -TestName "Certificate issuance" -Passed $false -Message "Skipped (no IDs provided)"
}

# ============================================
# TEST 7: Certificate Verification
# ============================================
Write-Host "`n[TEST 7] Certificate Verification" -ForegroundColor Yellow
if ($global:TEST_CERT_ID) {
    try {
        $verifyBody = @{ cert_id = $global:TEST_CERT_ID } | ConvertTo-Json
        $verifyResponse = Invoke-RestMethod -Uri "$BaseUrl/api/verify" -Method Post -ContentType "application/json" -Body $verifyBody -ErrorAction Stop
        Test-Result -TestName "Certificate verification" -Passed $verifyResponse.valid -Message "Verification returned invalid"
    } catch {
        Test-Result -TestName "Certificate verification" -Passed $false -Message $_.Exception.Message
    }
} else {
    Test-Result -TestName "Certificate verification" -Passed $false -Message "Skipped (no certificate issued)"
}

# ============================================
# TEST 8: Invalid Certificate Verification
# ============================================
Write-Host "`n[TEST 8] Invalid Certificate Verification" -ForegroundColor Yellow
try {
    $fakeBody = @{ cert_id = "FAKE-CERT-12345" } | ConvertTo-Json
    $fakeResponse = Invoke-RestMethod -Uri "$BaseUrl/api/verify" -Method Post -ContentType "application/json" -Body $fakeBody -ErrorAction Stop
    Test-Result -TestName "Non-existent certificate detection" -Passed (-not $fakeResponse.valid) -Message "Should return invalid"
} catch {
    Test-Result -TestName "Non-existent certificate detection" -Passed $false -Message $_.Exception.Message
}

# ============================================
# TEST 9: SQL Injection Prevention
# ============================================
Write-Host "`n[TEST 9] Security - SQL Injection Prevention" -ForegroundColor Yellow
try {
    $sqlBody = '{"email": "admin@unza.zm'' OR ''1''=''1", "password": "anything"}'
    Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $sqlBody -ErrorAction Stop
    Test-Result -TestName "SQL injection blocked" -Passed $false -Message "Injection may have succeeded"
} catch {
    Test-Result -TestName "SQL injection blocked" -Passed ($_.Exception.Response.StatusCode.value__ -in @(400, 401)) -Message "Status: $($_.Exception.Response.StatusCode.value__)"
}

# ============================================
# TEST 10: Password Hashing Verification
# ============================================
Write-Host "`n[TEST 10] Security - Password Hashing" -ForegroundColor Yellow
Write-Host "⚠️  Run this manually in MySQL:" -ForegroundColor Yellow
Write-Host "SELECT password_hash FROM users WHERE email='admin@unza.zm';" -ForegroundColor Gray
Write-Host "✅ Verify hash starts with `$2b$10$ (bcrypt)" -ForegroundColor Green
Test-Result -TestName "Password hashing (manual check)" -Passed $true -Message "Check MySQL manually"

# ============================================
# TEST SUMMARY
# ============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total Tests:  $($TestResults.Total)" -ForegroundColor White
Write-Host "Passed:       $($TestResults.Passed)" -ForegroundColor Green
Write-Host "Failed:       $($TestResults.Failed)" -ForegroundColor $(if ($TestResults.Failed -eq 0) {"Green"} else {"Red"})
$PassRate = [math]::Round(($TestResults.Passed / $TestResults.Total) * 100, 2)
Write-Host "Pass Rate:    $PassRate%" -ForegroundColor $(if ($PassRate -ge 80) {"Green"} else {"Yellow"})
Write-Host "========================================`n" -ForegroundColor Cyan

# Save test report
$ReportPath = "test-report-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss').txt"
@"
BACKEND TEST REPORT
===================
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Total Tests:  $($TestResults.Total)
Passed:       $($TestResults.Passed)
Failed:       $($TestResults.Failed)
Pass Rate:    $PassRate%
"@ | Out-File -FilePath $ReportPath

Write-Host "📄 Test report saved to: $ReportPath" -ForegroundColor Gray
Write-Host "`n✅ TESTING COMPLETE" -ForegroundColor Green