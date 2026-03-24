sap.ui.define([
], function () {
    "use strict";

    return {

    _getCsrfToken: function() {
            var sBaseUrl = "/sap/opu/odata4/sap/zsb_dynamic_meta/srvd/sap/zsd_dynamic_meta/0001";
            return fetch(sBaseUrl + "/", {
                method: "HEAD",
                headers: { "X-CSRF-Token": "Fetch" }
            }).then(oResponse => oResponse.headers.get("X-CSRF-Token"));
        },
    }
});