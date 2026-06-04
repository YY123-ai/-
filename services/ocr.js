// Shared OCR module
var axios; try { axios = require('axios'); } catch(e) { axios = require('../server/node_modules/axios'); }
const crypto = require('crypto');

const BAIDU_OCR_API_KEY = process.env.BAIDU_OCR_API_KEY || '';
const BAIDU_OCR_SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY || '';
const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID || '';
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

var baiduToken = null;
var baiduTokenExpire = 0;

function extractAmountFromText(text) {
  var amount = null;
  // 优先级1：微信/支付宝格式 "金额 ¥35.50"
  var wechatMatch = text.match(/金额\s*[¥￥]?\s*(\d+(?:[,，]\d{3})*(?:\.\d+)?)/);
  if (wechatMatch) { var n = parseFloat(wechatMatch[1].replace(/[,，]/g, '')); if (!isNaN(n) && n > 0 && n < 1000000) amount = n; }
  // 优先级2：¥￥符号后跟数字
  if (!amount) { var yenMatch = text.match(/[¥￥]\s*(\d+(?:[,，]\d{3})*(?:\.\d+)?)/); if (yenMatch) { var n2 = parseFloat(yenMatch[1].replace(/[,，]/g, '')); if (!isNaN(n2) && n2 > 0 && n2 < 1000000) amount = n2; } }
  // 优先级3：关键词后跟金额
  if (!amount) { var kwMatch = text.match(/(?:合计|总计|金额|应付|实付|实收|小计|消费|收款|付款|支付|转账|退款|收入|Total|TOTAL)\s*[：:=]*\s*[¥￥]?\s*(\d+(?:[,，]\d{3})*(?:\.\d+)?)/); if (kwMatch) { var n3 = parseFloat(kwMatch[1].replace(/[,，]/g, '')); if (!isNaN(n3) && n3 > 0 && n3 < 1000000) amount = n3; } }
  // 优先级4：数字+元
  if (!amount) { var yuanMatch = text.match(/(\d+(?:[,，]\d{3})*\.\d+)\s*元/); if (yuanMatch) { var n4 = parseFloat(yuanMatch[1].replace(/[,，]/g, '')); if (!isNaN(n4) && n4 > 0 && n4 < 1000000) amount = n4; } }
  // 优先级5：所有小数数字（排除年份）
  if (!amount) { var allNums = text.match(/\d+(?:[,，]\d{3})*\.\d+/g); if (allNums) { for (var i = allNums.length - 1; i >= 0; i--) { var n5 = parseFloat(allNums[i].replace(/[,，]/g, '')); if (!isNaN(n5) && n5 > 0 && n5 < 1000000 && !(n5 >= 1900 && n5 <= 2100)) { amount = n5; break; } } } }
  // 优先级6：关键词后跟整数（含千分位）
  if (!amount) { var intMatch = text.match(/(?:合计|总计|金额|应付|实付|实收|小计|消费|收款|付款|支付|转账|收入)\s*[：:=]*\s*[¥￥]?\s*(\d+(?:[,，]\d{3})+)/); if (intMatch) { var n6 = parseFloat(intMatch[1].replace(/[,，]/g, '')); if (!isNaN(n6) && n6 > 0 && n6 < 1000000) amount = n6; } }
  return amount;
}

function extractDateFromText(text) {
  var dm = text.match(/(\d{4})\s*[-\/\u5E74]\s*(\d{1,2})\s*[-\/\u6708]\s*(\d{1,2})/);
  if (dm) {
    var y = parseInt(dm[1]), m = parseInt(dm[2]), d = parseInt(dm[3]);
    if (y >= 2020 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }
  }
  return null;
}

function extractNoteFromText(text) {
  var ls = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length >= 2 && l.length <= 15; });
  var cl = ls.filter(function(l) { return /[\u4e00-\u9fff]/.test(l) && !/^(合计|总计|金额|应付|实付|收款|付款|消费|支出|收入|日期|时间|备注|分类|账户|流水|详情)$/.test(l); });
  return cl.slice(0, 2).join('') || '';
}

async function getBaiduToken() {
  if (!BAIDU_OCR_API_KEY || !BAIDU_OCR_SECRET_KEY) return null;
  if (baiduToken && Date.now() < baiduTokenExpire) return baiduToken;
  try {
    var res = await axios.get('https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=' + BAIDU_OCR_API_KEY + '&client_secret=' + BAIDU_OCR_SECRET_KEY);
    if (res.data && res.data.access_token) {
      baiduToken = res.data.access_token;
      baiduTokenExpire = Date.now() + (res.data.expires_in - 86400) * 1000;
      return baiduToken;
    }
  } catch (e) {}
  return null;
}

async function recognizeWithBaidu(base64) {
  var token = await getBaiduToken();
  if (!token) return null;
  try {
    var r1 = await axios.post('https://aip.baidubce.com/rest/2.0/ocr/v1/receipt?access_token=' + token, 'image=' + encodeURIComponent(base64), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });
    if (r1.data && r1.data.words_result) {
      var txt = r1.data.words_result.map(function(w) { return w.words; }).join('\n');
      return { text: txt, engine: 'baidu-receipt', confidence: 90 };
    }
  } catch (e) {}
  try {
    var r2 = await axios.post('https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=' + token, 'image=' + encodeURIComponent(base64), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });
    if (r2.data && r2.data.words_result) {
      var txt2 = r2.data.words_result.map(function(w) { return w.words; }).join('\n');
      return { text: txt2, engine: 'baidu-general', confidence: 85 };
    }
  } catch (e) {}
  return null;
}

function getTencentHeaders(payload) {
  var svc = 'ocr';
  var host = 'ocr.tencentcloudapi.com';
  var ts = Math.floor(Date.now() / 1000);
  var date = new Date(ts * 1000).toISOString().split('T')[0];
  var h = 'content-type:application/json; charset=utf-8\nhost:' + host + '\nx-tc-action:generalbASICoCR\n';
  var sh = 'content-type;host;x-tc-action';
  var hp = crypto.createHash('sha256').update(payload).digest('hex');
  var cr = 'POST\n/\n\n' + h + sh + '\n' + hp;
  var cs = date + '/' + svc + '/tc3_request';
  var sts = 'TC3-HMAC-SHA256\n' + ts + '\n' + cs + '\n' + crypto.createHash('sha256').update(cr).digest('hex');
  var sd = crypto.createHmac('sha256', 'TC3' + TENCENT_SECRET_KEY).update(date).digest();
  var ss = crypto.createHmac('sha256', sd).update(svc).digest();
  var sig = crypto.createHmac('sha256', ss).update('tc3_request').digest();
  return { 'Content-Type': 'application/json; charset=utf-8', 'Host': host, 'X-TC-Action': 'GeneralBasicOCR', 'X-TC-Version': '2018-11-19', 'X-TC-Region': 'ap-beijing', 'X-TC-Timestamp': String(ts), 'Authorization': 'TC3-HMAC-SHA256 Credential=' + TENCENT_SECRET_ID + '/' + cs + ', SignedHeaders=' + sh + ', Signature=' + sig };
}

async function recognizeWithTencent(base64) {
  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) return null;
  try {
    var p = JSON.stringify({ ImageBase64: base64 });
    var r = await axios.post('https://ocr.tencentcloudapi.com/', p, { headers: getTencentHeaders(p), timeout: 15000 });
    if (r.data && r.data.Response && r.data.Response.TextDetections) {
      var txt = r.data.Response.TextDetections.map(function(t) { return t.DetectedText; }).join('\n');
      return { text: txt, engine: 'tencent', confidence: 80 };
    }
  } catch (e) {}
  return null;
}

async function analyzeWithDeepSeek(text) {
  if (!DEEPSEEK_API_KEY || text.length < 10) return null;
  try {
    var r = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: 'Extract amount, date, description from text. Return JSON.' }, { role: 'user', content: text }],
      temperature: 0.1, max_tokens: 200
    }, { headers: { 'Authorization': 'Bearer ' + DEEPSEEK_API_KEY, 'Content-Type': 'application/json' }, timeout: 15000 });
    if (r.data && r.data.choices && r.data.choices[0]) {
      var content = r.data.choices[0].message.content;
      var jm = content.match(/\{[\s\S]*\}/);
      if (jm) {
        var p = JSON.parse(jm[0]);
        return { amount: p.amount ? parseFloat(p.amount) : null, date: p.date || null, description: p.description || null };
      }
    }
  } catch (e) {}
  return null;
}

async function recognizeImage(imageData) {
  var b64 = imageData.replace(/^data:image\/\w+;base64,/, '');
  var amount = null, date = null, note = '', engine = 'local', confidence = 60, fullText = '';
  // Try Baidu
  var baiduRes = await recognizeWithBaidu(b64);
  if (baiduRes) {
    fullText = baiduRes.text; amount = extractAmountFromText(fullText); date = extractDateFromText(fullText); note = extractNoteFromText(fullText); engine = baiduRes.engine; confidence = baiduRes.confidence;
  }
  // Try Tencent
  if (!fullText) {
    var tenRes = await recognizeWithTencent(b64);
    if (tenRes) { fullText = tenRes.text; amount = extractAmountFromText(fullText); date = extractDateFromText(fullText); note = extractNoteFromText(fullText); engine = tenRes.engine; confidence = tenRes.confidence; }
  }
  // Try AI
  if (fullText && fullText.length > 10) {
    var aiRes = await analyzeWithDeepSeek(fullText);
    if (aiRes) {
      if (aiRes.amount !== null && aiRes.amount > 0) { amount = aiRes.amount; confidence = Math.min(confidence + 15, 95); engine = engine + '+AI'; }
      if (aiRes.date && !date) date = aiRes.date;
      if (aiRes.description && !note) note = aiRes.description;
    }
  }
  return { success: true, amount: amount, date: date, note: note, text: fullText, engine: engine, confidence: confidence };
}

module.exports = { recognizeImage: recognizeImage, extractAmountFromText: extractAmountFromText, extractDateFromText: extractDateFromText, extractNoteFromText: extractNoteFromText };