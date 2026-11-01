<?php
/**
 * Litma MCP endpoint — https://www.jayageetham.com/litma/mcp
 *
 * A thin relay to the litma-mcp Supabase Edge Function, so MCP clients (Claude, ChatGPT,
 * IBM Bob, Cursor…) can use a URL on jayageetham.com. It holds no secrets: callers
 * authenticate with their own Litma token, which the Edge Function verifies.
 */
declare(strict_types=1);

const UPSTREAM = 'https://jdexadomaxjtxlvgtldu.supabase.co/functions/v1/litma-mcp';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: authorization, content-type, accept, mcp-session-id, mcp-protocol-version');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Expose-Headers: mcp-session-id, mcp-protocol-version');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if ($auth === '' && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) {
        if (strtolower($k) === 'authorization') { $auth = $v; break; }
    }
}

$headers = ['Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'application/json')];
$headers[] = 'Accept: ' . ($_SERVER['HTTP_ACCEPT'] ?? 'application/json, text/event-stream');
if ($auth !== '') $headers[] = 'Authorization: ' . $auth;
foreach (['HTTP_MCP_SESSION_ID' => 'Mcp-Session-Id', 'HTTP_MCP_PROTOCOL_VERSION' => 'Mcp-Protocol-Version'] as $server => $name) {
    if (!empty($_SERVER[$server])) $headers[] = $name . ': ' . $_SERVER[$server];
}

$query = $_SERVER['QUERY_STRING'] ?? '';
$url = UPSTREAM . ($query !== '' ? '?' . $query : '');
$body = file_get_contents('php://input') ?: '';

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $method === 'GET' ? null : $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $resp = curl_exec($ch);
    if ($resp === false) {
        http_response_code(502);
        header('Content-Type: application/json');
        echo json_encode(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32603, 'message' => 'Litma MCP upstream unreachable: ' . curl_error($ch)]]);
        exit;
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    $rawHeaders = substr($resp, 0, $headerSize);
    $payload = substr($resp, $headerSize);
} else {
    $ctx = stream_context_create(['http' => [
        'method' => $method,
        'header' => implode("\r\n", $headers),
        'content' => $body,
        'ignore_errors' => true,
        'timeout' => 60,
    ]]);
    $payload = @file_get_contents($url, false, $ctx);
    $rawHeaders = implode("\r\n", $http_response_header ?? []);
    preg_match('#HTTP/\S+\s+(\d{3})#', $rawHeaders, $m);
    $status = isset($m[1]) ? (int) $m[1] : 502;
    if ($payload === false) $payload = '';
}

http_response_code($status);
foreach (preg_split('/\r?\n/', $rawHeaders) as $line) {
    if (preg_match('/^(content-type|mcp-session-id|mcp-protocol-version|www-authenticate|allow):/i', $line)) {
        header(trim($line), true);
    }
}
echo $payload;
