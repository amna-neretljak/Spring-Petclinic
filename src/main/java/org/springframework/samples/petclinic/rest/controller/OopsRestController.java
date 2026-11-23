package org.springframework.samples.petclinic.rest.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.rest.api.OopsApi;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sample endpoint used by the React Error page to show how failures are rendered.
 */
@RestController
@CrossOrigin(exposedHeaders = "errors, content-type")
@RequestMapping("api")
public class OopsRestController implements OopsApi {

    @Override
    public ResponseEntity<String> failingRequest() {
        throw new RuntimeException("Expected: controller used to showcase what happens when an exception is thrown");
    }
}
