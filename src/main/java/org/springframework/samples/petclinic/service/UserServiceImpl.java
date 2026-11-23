package org.springframework.samples.petclinic.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.samples.petclinic.model.User;
import org.springframework.samples.petclinic.model.Role;
import org.springframework.samples.petclinic.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserRepository userRepository;

    @Override
    @Transactional
    public void saveUser(User user) {

        if(user.getRoles() == null || user.getRoles().isEmpty()) {
            throw new IllegalArgumentException("User must have at least a role set!");
        }

        for (Role role : user.getRoles()) {
            if(!role.getName().startsWith("ROLE_")) {
                role.setName("ROLE_" + role.getName());
            }

            if(role.getUser() == null) {
                role.setUser(user);
            }
        }

        userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean login(String username, String password) {
        User user = userRepository.findByUsername(username);
        if (user == null || !Boolean.TRUE.equals(user.getEnabled())) {
            return false;
        }
        String stored = user.getPassword();
        if (stored != null && stored.startsWith("{noop}")) {
            stored = stored.substring("{noop}".length());
        }
        return stored != null && stored.equals(password);
    }
}
