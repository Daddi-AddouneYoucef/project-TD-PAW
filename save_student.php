<?php
header('Content-Type: application/json');

$input = file_get_contents('php://input');
$newStudent = json_decode($input, true);

if (!$newStudent) {
    echo json_encode(['status' => 'error', 'message' => 'No data']);
    exit;
}

$file = 'students.json';
$currentData = file_exists($file) ? json_decode(file_get_contents($file), true) : [];

$currentData[] = $newStudent;

if (file_put_contents($file, json_encode($currentData, JSON_PRETTY_PRINT))) {
    echo json_encode(['status' => 'success']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Could not write to file']);
}
?>