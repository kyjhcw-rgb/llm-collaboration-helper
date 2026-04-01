FROM gradle:21-jdk AS build
WORKDIR /app
COPY . .

#gradle권한 추가
RUN chmod +x ./gradlew

RUN ./gradlew clean build -x test

FROM openjdk:21-jdk-slim
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]