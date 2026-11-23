package org.springframework.samples.petclinic.rest.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.samples.petclinic.rest.advice.ExceptionControllerAdvice;
import org.springframework.samples.petclinic.service.UserService;
import org.springframework.samples.petclinic.service.clinicService.ApplicationTestConfig;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ContextConfiguration(classes = ApplicationTestConfig.class)
@WebAppConfiguration
class LoginRestControllerTests {

    @Autowired
    private LoginRestController loginRestController;

    @MockBean
    private UserService userService;

    private MockMvc mockMvc;

    @BeforeEach
    void init() {
        this.mockMvc = MockMvcBuilders.standaloneSetup(loginRestController)
            .setControllerAdvice(new ExceptionControllerAdvice())
            .build();
    }

    @Test
    void testLoginSuccess() throws Exception {
        given(this.userService.login("admin", "admin")).willReturn(true);

        this.mockMvc.perform(post("/api/login")
                .content("{\"username\":\"admin\",\"password\":\"admin\"}")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isOk())
            .andExpect(content().string(""));
    }

    @Test
    void testLoginUnknownUsername() throws Exception {
        given(this.userService.login("nobody", "admin")).willReturn(false);

        this.mockMvc.perform(post("/api/login")
                .content("{\"username\":\"nobody\",\"password\":\"admin\"}")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isUnauthorized())
            .andExpect(content().string(""));
    }

    @Test
    void testLoginWrongPassword() throws Exception {
        given(this.userService.login("admin", "wrong")).willReturn(false);

        this.mockMvc.perform(post("/api/login")
                .content("{\"username\":\"admin\",\"password\":\"wrong\"}")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isUnauthorized())
            .andExpect(content().string(""));
    }
}
