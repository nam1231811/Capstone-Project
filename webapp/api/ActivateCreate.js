sap.ui.define([
], function () {
    "use strict";

    return {

    postActivate: function (sUuid, sFieldname, sEtag) {
        var sBaseUrl = "/sap/opu/odata4/sap/zsb_dynamic_meta/srvd/sap/zsd_dynamic_meta/0001";            
            return this._getCsrfToken().then(function(sCsrfToken) {
                var sActivateUrl = sBaseUrl 
                    + "/Meta(uuid=" + sUuid 
                    + ",fieldname='" + sFieldname 
                    + "',IsActiveEntity=false)/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.Activate";

                console.log("Fetching Activate for:", sFieldname, "with ETag:", sEtag);

                return fetch(sActivateUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": sCsrfToken,
                        "If-Match": sEtag || "*"
                    },
                    body: JSON.stringify({})
                }).then(function(oResponse) {
                    if (!oResponse.ok) {
                        throw new Error("Activate failed");
                    }
                    var sActiveEtag = oResponse.headers.get("ETag");
                    var sSaveDbUrl = sBaseUrl 
                        + "/Meta(uuid=" + sUuid 
                        + ",fieldname='" + sFieldname 
                        + "',IsActiveEntity=true)/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase";

                    return fetch(sSaveDbUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRF-Token": sCsrfToken,
                            "If-Match": sActiveEtag || "*"
                        },
                        body: JSON.stringify({})
                    });
                });
            }.bind(this));
        },

    _getCsrfToken: function() {
            var sBaseUrl = "/sap/opu/odata4/sap/zsb_dynamic_meta/srvd/sap/zsd_dynamic_meta/0001";
            return fetch(sBaseUrl + "/", {
                method: "HEAD",
                headers: { "X-CSRF-Token": "Fetch" }
            }).then(oResponse => oResponse.headers.get("X-CSRF-Token"));
        },
    }
});