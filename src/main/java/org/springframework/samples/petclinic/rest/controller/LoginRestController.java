package org.springframework.samples.petclinic.rest.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.rest.api.LoginApi;
import org.springframework.samples.petclinic.rest.dto.LoginDto;
import org.springframework.samples.petclinic.service.UserService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(exposedHeaders = "errors, content-type")
@RequestMapping("api")
public class LoginRestController implements LoginApi {

    private final UserService userService;

    public LoginRestController(UserService userService) {
        this.userService = userService;
    }

    @Override
    public ResponseEntity<Void> login(LoginDto loginDto) {
        if (this.userService.login(loginDto.getUsername(), loginDto.getPassword())) {
            return new ResponseEntity<>(HttpStatus.OK);
        }
        return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
    }
}
