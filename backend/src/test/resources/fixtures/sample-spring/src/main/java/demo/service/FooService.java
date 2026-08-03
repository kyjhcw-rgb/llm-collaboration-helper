package demo.service;

import org.springframework.stereotype.Service;

@Service
public class FooService {

    public String findFoo(String id) {
        return id;
    }
}
