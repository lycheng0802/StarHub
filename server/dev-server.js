/**
 * 本地开发服务器
 * 用于模拟 Cloudflare Workers 的 OAuth token 交换功能
 * 
 * 使用方法：
 * 1. 创建 .env 文件，设置 CLIENT_ID 和 CLIENT_SECRET
 * 2. 运行：node server/dev-server.js
 * 3. 确保 vite.config.ts 中的 proxy 配置已启用
 */

// 加载 .env 文件
require('dotenv').config()

const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

// 从环境变量读取
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

if (!CLIENT_ID) {
  console.error('❌ Error: CLIENT_ID is not set')
  console.error('Please set CLIENT_ID in .env file')
  console.error('Or read from src/config/oauth.ts (manual copy required)')
  process.exit(1)
}

if (!CLIENT_SECRET) {
  console.error('❌ Error: CLIENT_SECRET is not set')
  console.error('Please set CLIENT_SECRET in .env file (obtain from GitHub OAuth App)')
  console.error('Get it from: https://github.com/settings/developers > Your OAuth App > Client Secret')
  process.exit(1)
}

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 配置端点 - 返回 CLIENT_ID 給前端
app.get('/api/config', (req, res) => {
  res.json({ clientId: CLIENT_ID })
})

app.get('/api/getToken', async (req, res) => {
  const { code } = req.query
  
  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' })
  }
  
  // 重试机制：最多重试3次
  let retryCount = 0
  const maxRetries = 3
  const retryDelay = 2000 // 2秒
  
  while (retryCount <= maxRetries) {
    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时
      
      const response = await fetch(
        `https://github.com/login/oauth/access_token?code=${code}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }
      )
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GitHub API 返回错误: ${response.status} ${response.statusText} - ${errorText}`)
      }
      
      const data = await response.json()
      
      if (!data.access_token) {
        console.error('GitHub OAuth error:', data)
        return res.status(500).json({ 
          error: 'Failed to get access token',
          details: data.error_description || data.error
        })
      }
      
      // 生成应用 token（与原项目一致）
      const appToken = `app_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      return res.json({
        token: appToken,
        token_type: data.token_type || 'token',
        access_token: data.access_token
      })
    } catch (error) {
      // 检查是否是超时或连接错误
      const isRetryableError = 
        error.name === 'AbortError' ||
        error.code === 'ECONNRESET' ||
        error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('fetch failed')
      
      if (isRetryableError && retryCount < maxRetries) {
        retryCount++
        console.warn(`⚠️ OAuth request failed (${error.message}), retrying in ${retryDelay/1000} seconds (${retryCount}/${maxRetries})...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }
      
      // 非重试错误或已达到最大重试次数
      console.error('OAuth error:', error)
      return res.status(500).json({ 
        error: 'Failed to exchange token', 
        details: error.message,
        retries: retryCount
      })
    }
  }
})

// 靜態檔案服務（正式環境）
const path = require('path')
const distPath = path.join(__dirname, 'dist')

// 檢查 dist 資料夾是否存在
const fs = require('fs')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  
  // SPA fallback - 所有非 /api 請求都返回 index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
  console.log('📦 Static file serving enabled')
}

const PORT = process.env.PORT || 7001
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
  if (fs.existsSync(distPath)) {
    console.log(`🌐 Frontend service: http://localhost:${PORT}`)
  }
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`)
  console.log(`\n⚠️  If you encounter connection errors, please check:`)
  console.log(`   1. Ensure this server is running`)
  console.log(`   2. Check network connection and firewall settings`)
  console.log(`   3. Confirm GitHub OAuth App CLIENT_ID and CLIENT_SECRET are correctly configured\n`)
})
