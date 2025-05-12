# Use an official node image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /app

COPY . /app

RUN npm install

RUN npm run build

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Run app.js when the container launches
CMD ["npm", "start"]