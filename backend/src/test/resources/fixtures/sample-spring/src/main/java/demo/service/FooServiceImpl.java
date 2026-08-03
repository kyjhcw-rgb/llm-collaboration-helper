package demo.service;

import org.springframework.stereotype.Service;

@Service
public class FooServiceImpl implements FooRepository {

    @Override
    public String findById(String id) {
        return id;
    }
}
