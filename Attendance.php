<?php
session_start();

$servername = "localhost";
$username = "root";
$password = "";
$dbname = "attendance_db";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

function getInitials($fname, $lname) {
    return strtoupper(substr($fname, 0, 1) . substr($lname, 0, 1));
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST['ajax_update'])) {
    $studentId = $_POST['student_id'];
    $week = $_POST['week'];
    $type = $_POST['type']; 
    $value = (int)$_POST['value'];

    $check = $conn->prepare("SELECT present, participated FROM attendance WHERE student_id = ? AND week = ?");
    $check->bind_param("si", $studentId, $week);
    $check->execute();
    $res = $check->get_result();
    
    $curPres = 0; $curPart = 0;
    if ($row = $res->fetch_assoc()) {
        $curPres = $row['present'];
        $curPart = $row['participated'];
    }
    $check->close();

    if ($type === 'present') $curPres = $value;
    if ($type === 'participated') $curPart = $value;

    $stmt = $conn->prepare("INSERT INTO attendance (student_id, week, present, participated) VALUES (?, ?, ?, ?) 
                            ON DUPLICATE KEY UPDATE present = VALUES(present), participated = VALUES(participated)");
    $stmt->bind_param("siii", $studentId, $week, $curPres, $curPart);
    $stmt->execute();
    $stmt->close();
    
    echo "saved";
    exit;
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST['studentId'])) {
    $sid = trim($_POST['studentId']);
    $lname = trim($_POST['lastName']);
    $fname = trim($_POST['firstName']);
    $email = isset($_POST['email']) ? trim($_POST['email']) : ''; 
    
    $stmt = $conn->prepare("INSERT IGNORE INTO students (student_id, last_name, first_name) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $sid, $lname, $fname);
    $stmt->execute();
    
    for($w=1; $w<=6; $w++){
        $conn->query("INSERT IGNORE INTO attendance (student_id, week) VALUES ('$sid', $w)");
    }
    
    header("Location: " . $_SERVER['PHP_SELF']);
    exit;
}

$students = [];
$sql = "SELECT s.student_id, s.last_name, s.first_name, a.week, a.present, a.participated
        FROM students s
        LEFT JOIN attendance a ON s.student_id = a.student_id
        ORDER BY s.last_name ASC, a.week ASC";
$result = $conn->query($sql);

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $sid = $row['student_id'];
        if (!isset($students[$sid])) {
            $students[$sid] = [ "info" => $row, "weeks" => [] ];
        }
        if ($row['week']) {
            $students[$sid]["weeks"][$row['week']] = [ "p" => $row['present'], "pa" => $row['participated'] ];
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attendance Manager</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <link rel="stylesheet" href="TP1.css">
</head>
<body>

    <div class="container">
        
        <header class="header">
            <div class="title-group">
                <h1>Class Tracker</h1>
                <p>Monitor student progress & participation</p>
            </div>
            <a href="#add-area" class="btn-add">
                <span style="font-size:1.2rem; line-height:0;">+</span> New Student
            </a>
        </header>

        <div id="toast">
            <div style="background:#10b981; width:8px; height:8px; border-radius:50%;"></div>
            <span id="toast-msg">Saved successfully</span>
        </div>

        <div class="controls-panel">
            <h3>Exercise Controls</h3>
            
            <div class="control-row">
                <input type="text" id="jq-search" class="modern-input" placeholder="Search by Name...">
            </div>

            <div class="control-row buttons-row">
                <button id="btn-show-report" class="btn-secondary">📊 Show Report</button>
                <button id="btn-highlight-exc" class="btn-secondary">✨ Highlight Excellent</button>
                <button id="btn-reset-colors" class="btn-outline">Reset Colors</button>
                <button id="btn-sort-abs" class="btn-outline">Sort: Absences (Asc)</button>
                <button id="btn-sort-part" class="btn-outline">Sort: Participation (Desc)</button>
            </div>
            
            <div id="sort-message" style="margin-top:10px; font-size:0.85rem; color:#64748b; font-style:italic;"></div>
        </div>

        <div id="report-section" class="glass-card" style="display:none; margin-bottom: 20px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Class Statistics</h3>
                <button id="btn-close-report" style="border:none; background:transparent; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            <div style="height: 300px; width: 100%; display:flex; justify-content:center;">
                <canvas id="attendanceChart"></canvas>
            </div>
            <div id="stats-text" style="display:flex; justify-content:space-around; margin-top:20px; font-weight:bold;"></div>
        </div>

        <div class="glass-card">
            <div class="table-wrapper">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th class="col-sticky" rowspan="2" style="padding-left:20px;">Student Name</th>
                            <?php for ($i=1; $i<=6; $i++): ?>
                                <th colspan="2" style="text-align:center; border-bottom:none;">Week <?= $i ?></th>
                            <?php endfor; ?>
                            <th rowspan="2" style="text-align:center;">Insights</th>
                        </tr>
                        <tr>
                            <?php for ($i=1; $i<=6; $i++): ?>
                                <th style="font-size:0.65rem; color:#94a3b8; text-align:center;">Pr</th>
                                <th style="font-size:0.65rem; color:#94a3b8; text-align:center;">Pa</th>
                            <?php endfor; ?>
                        </tr>
                    </thead>
                    <tbody id="student-table-body">
                        <?php if (empty($students)): ?>
                            <tr><td colspan="14" style="padding:40px; text-align:center; color:#94a3b8;">No students yet. Start by adding one below.</td></tr>
                        <?php else: ?>
                            <?php foreach ($students as $sid => $data): 
                                $initials = getInitials($data['info']['first_name'], $data['info']['last_name']);
                            ?>
                                <tr data-id="<?= $sid ?>">
                                    <td class="col-sticky">
                                        <div class="student-profile">
                                            <div class="avatar"><?= $initials ?></div>
                                            <div class="student-info">
                                                <div class="s-name"><?= htmlspecialchars($data['info']['last_name'] . ", " . $data['info']['first_name']) ?></div>
                                                <div class="s-id" style="font-size:0.75rem; color:#64748b;">ID: <?= $sid ?></div>
                                            </div>
                                        </div>
                                    </td>

                                    <?php for ($w=1; $w<=6; $w++): 
                                        $p = $data['weeks'][$w]['p'] ?? 0;
                                        $pa = $data['weeks'][$w]['pa'] ?? 0;
                                    ?>
                                        <td>
                                            <label class="toggle-wrapper">
                                                <input type="checkbox" class="chk-present" 
                                                       data-sid="<?= $sid ?>" data-week="<?= $w ?>" data-type="present"
                                                       <?= $p ? 'checked' : '' ?>>
                                                <span class="toggle-check" title="Mark Present"></span>
                                            </label>
                                        </td>
                                        <td>
                                            <label class="toggle-wrapper">
                                                <input type="checkbox" class="chk-participated" 
                                                       data-sid="<?= $sid ?>" data-week="<?= $w ?>" data-type="participated"
                                                       <?= $pa ? 'checked' : '' ?>>
                                                <span class="toggle-check" title="Mark Participation"></span>
                                            </label>
                                        </td>
                                    <?php endfor; ?>

                                    <td style="text-align:center;">
                                        <div class="stat-pill stat-abs"><span class="absences">0</span> Abs</div>
                                        <div class="stat-pill stat-part"><span class="participation">0</span> Part</div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <div id="add-area" class="add-section">
            <h3 style="margin-bottom:20px; font-weight:700;">Add New Student</h3>
            
            <form method="POST">
                <div class="input-group" style="margin-bottom:20px;">
                    <label>Student ID</label>
                    <input type="text" name="studentId" class="modern-input" placeholder="e.g. 2024001" required>
                </div>
                
                <div class="form-grid">
                    <div class="input-group">
                        <label>Last Name</label>
                        <input type="text" name="lastName" class="modern-input" required>
                    </div>
                    <div class="input-group">
                        <label>First Name</label>
                        <input type="text" name="firstName" class="modern-input" required>
                    </div>
                </div>

                <div class="input-group" style="margin-top:10px;">
                    <label>Email Address</label>
                    <input type="email" name="email" class="modern-input" placeholder="student@example.com">
                </div>

                <button type="submit" class="btn-add" style="width:100%; justify-content:center; padding:14px; border:none; cursor:pointer; margin-top: 15px;">
                    Add Student
                </button>
            </form>
        </div>

    </div>

    <script src="TP1.js"></script>
    
</body>
</html>