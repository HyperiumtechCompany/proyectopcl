<?php
  $path = 'database/data/normativa_en15193.json';
  $content = file_get_contents($path);
  $content = preg_replace('/^' . pack('H*','EFBBBF') . '/', '', $content);
  file_put_contents($path, $content);

