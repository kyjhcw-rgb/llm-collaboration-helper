package com.capstone.collaborationhelper.code2diagram.parse;

import com.capstone.collaborationhelper.code2diagram.model.ParsedMethod;
import com.capstone.collaborationhelper.code2diagram.model.ParsedType;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Modifier;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.expr.AnnotationExpr;
import com.github.javaparser.ast.type.ClassOrInterfaceType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * JavaParser로 .java 파일을 ParsedType IR로 변환한다.
 * top-level class/interface만 대상 (inner class 제외).
 */
@Component
public class JavaSourceParser {

    private static final Logger log = LoggerFactory.getLogger(JavaSourceParser.class);

    public List<ParsedType> parseAll(List<Path> files) {
        List<ParsedType> result = new ArrayList<>();
        for (Path file : files) {
            try {
                result.addAll(parse(file));
            } catch (Exception e) {
                log.warn("파싱 실패, 건너뜀: {} ({})", file, e.getMessage());
            }
        }
        return result;
    }

    public List<ParsedType> parse(Path file) throws IOException {
        CompilationUnit cu = StaticJavaParser.parse(file);
        String packageName = cu.getPackageDeclaration()
                .map(pd -> pd.getNameAsString())
                .orElse("");
        String sourcePath = file.toString().replace('\\', '/');

        List<ParsedType> types = new ArrayList<>();
        for (ClassOrInterfaceDeclaration type : cu.findAll(ClassOrInterfaceDeclaration.class)) {
            // top-level만: 부모가 CompilationUnit인 경우
            if (!type.isTopLevelType()) {
                continue;
            }
            types.add(toParsedType(type, packageName, sourcePath));
        }
        return types;
    }

    private ParsedType toParsedType(
            ClassOrInterfaceDeclaration type,
            String packageName,
            String sourcePath
    ) {
        String simpleName = type.getNameAsString();
        String fqn = packageName.isEmpty() ? simpleName : packageName + "." + simpleName;

        List<String> annotations = type.getAnnotations().stream()
                .map(this::annotationSimpleName)
                .toList();

        List<String> extended = type.getExtendedTypes().stream()
                .map(ClassOrInterfaceType::getNameAsString)
                .toList();

        List<String> implemented = type.getImplementedTypes().stream()
                .map(ClassOrInterfaceType::getNameAsString)
                .toList();

        List<ParsedMethod> methods = type.getMethods().stream()
                .map(this::toParsedMethod)
                .toList();

        return ParsedType.builder()
                .simpleName(simpleName)
                .packageName(packageName)
                .fqn(fqn)
                .kind(type.isInterface() ? "interface" : "class")
                .annotations(new ArrayList<>(annotations))
                .methods(new ArrayList<>(methods))
                .extendedTypes(new ArrayList<>(extended))
                .implementedTypes(new ArrayList<>(implemented))
                .sourcePath(sourcePath)
                .build();
    }

    private ParsedMethod toParsedMethod(MethodDeclaration method) {
        String params = method.getParameters().stream()
                .map(this::formatParameter)
                .collect(Collectors.joining(", "));

        return ParsedMethod.builder()
                .name(method.getNameAsString())
                .parameters(params.isEmpty() ? null : params)
                .returnType(method.getType().asString())
                .isPublic(method.hasModifier(Modifier.Keyword.PUBLIC)
                        || method.getParentNode()
                        .filter(ClassOrInterfaceDeclaration.class::isInstance)
                        .map(ClassOrInterfaceDeclaration.class::cast)
                        .map(ClassOrInterfaceDeclaration::isInterface)
                        .orElse(false))
                .build();
    }

    private String formatParameter(Parameter parameter) {
        return parameter.getType().asString() + " " + parameter.getNameAsString();
    }

    private String annotationSimpleName(AnnotationExpr annotation) {
        String name = annotation.getNameAsString();
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot + 1) : name;
    }
}
