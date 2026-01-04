/**
 * GitHub OAuth 配置
 * 
 * GitHub OAuth 必须要有 Client ID（这是 GitHub 的安全要求）
 * Client ID 是公开的，可以安全地放在代码中
 * 
 * 获取方式：
 * 1. 访问 https://github.com/settings/developers
 * 2. 点击 "New OAuth App"
 * 3. 填写：
 *    - Application name: StarHub
 *    - Homepage URL: http://localhost:5173
 *    - Authorization callback URL: http://localhost:5173/#/login
 * 4. 复制 Client ID 填入下方
 */

/**
 * GitHub OAuth 配置
 * CLIENT_ID 從後端 /api/config 獲取
 */

let cachedClientId = ''

export async function getGitHubClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId

  const res = await fetch('/api/config')
  const data = await res.json()
  cachedClientId = data.clientId || ''
  return cachedClientId
}

export const GITHUB_OAUTH_CONFIG = {
  CLIENT_ID: ''
}

