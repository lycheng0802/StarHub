FROM node:18-alpine AS builder

WORKDIR /app

# 複製前端 package files 並安裝依賴
COPY package.json package-lock.json ./
RUN npm ci

# 複製前端程式碼並建構
COPY . .
RUN npm run build

# 正式環境映像
FROM node:18-alpine

WORKDIR /app

# 複製 server 的 package files 並安裝依賴
COPY server/package.json server/package-lock.json ./
RUN npm ci --only=production

# 複製 server 程式碼
COPY server/dev-server.js ./

# 從 builder 階段複製編譯後的前端檔案
COPY --from=builder /app/dist ./dist

EXPOSE 7001

CMD ["node", "dev-server.js"]