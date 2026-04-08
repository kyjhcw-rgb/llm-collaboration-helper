package com.capstone.collaborationhelper.repository;
import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PartyRepository extends JpaRepository<Party, Integer> {
    List<Party> findByUser(User user);
}