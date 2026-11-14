# Exact Node release; record/pin the resolved image digest before an actual public deployment.
FROM node:24.10.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 CLOSEOUT_BIND=0.0.0.0 CLOSEOUT_DB_PATH=/data/closeout.sqlite
RUN mkdir /data && chown node:node /data && chmod 700 /data
COPY --chown=node:node package.json LICENSE THIRD_PARTY_NOTICES.md ./
COPY --chown=node:node src ./src
COPY --chown=node:node server ./server
COPY --chown=node:node web ./web
USER node
VOLUME ["/data"]
EXPOSE 3000
STOPSIGNAL SIGTERM
# CLOSEOUT_PUBLIC_ORIGIN must be supplied explicitly; startup fails closed without it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "const http=require('node:http');const r=http.request({host:'127.0.0.1',port:process.env.CLOSEOUT_PORT||process.env.PORT||3000,path:'/api/health',headers:{host:new URL(process.env.CLOSEOUT_PUBLIC_ORIGIN).host}},s=>{s.resume();s.on('end',()=>process.exit(s.statusCode===200?0:1))});r.setTimeout(3000,()=>r.destroy());r.on('error',()=>process.exit(1));r.end()"
CMD ["node","server/start.ts"]
