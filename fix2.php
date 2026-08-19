<?php
foreach(['normativa_en12193.json', 'normativa_iesna.json'] as $f) {
  $path = 'database/data/' . $f;
  $content = file_get_contents($path);
  $content = preg_replace('/^' . pack('H*','EFBBBF') . '/', '', $content);
  file_put_contents($path, $content);
}

