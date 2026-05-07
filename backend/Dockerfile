FROM gradle:jdk21 AS build
WORKDIR /app

COPY backend/build.gradle backend/settings.gradle ./
COPY backend/ .

#gradle권한 추가
RUN chmod +x ./gradlew

RUN ./gradlew clean build -x test

FROM eclipse-temurin:21-jdk-jammy
WORKDIR /app    
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]