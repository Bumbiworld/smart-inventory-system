FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
ENV NEXT_PUBLIC_API_BASE_URL=x
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]