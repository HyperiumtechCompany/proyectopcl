<?php
foreach(['normativa_en12464_1.json', 'normativa_en12464_2.json', 'normativa_en13201_2.json'] as $f) {
  $path = 'database/data/' . $f;
  $content = file_get_contents($path);
  // Remove BOM if present
  $content = preg_replace('/^' . pack('H*','EFBBBF') . '/', '', $content);
  $decoded = json_decode($content, true);
  if ($decoded) {
    file_put_contents($path, json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo $f . ' fixed.\n';
  } else {
    echo $f . ' error: ' . json_last_error_msg() . '\n';
  }
}

