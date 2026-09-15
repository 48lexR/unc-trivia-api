FROM ubuntu:latest
RUN apt-get update -y && apt-get upgrade -y && apt-get install -y nodejs npm 
COPY ./api/ /var/www/
WORKDIR /var/www/
RUN npm i 
CMD ["npm", "run", "start"]
