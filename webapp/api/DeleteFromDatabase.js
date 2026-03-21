sap.ui.define([
    "zapp/api/ActivateCreate"
], function (ActivateCreate) {
    "use strict";

    return {
        postDelete: function (tableName, rowId) {
        var sBaseUrl = "/sap/opu/odata4/sap/zsb_dynamic_meta/srvd/sap/zsd_dynamic_meta/0001";            
            return ActivateCreate._getCsrfToken().then(function(sCsrfToken) {
                var sDeleteUrl = sBaseUrl 
                    + "/Meta/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.deleteFromDatabase";

                return fetch(sDeleteUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": sCsrfToken,
                    },
                    body: JSON.stringify({
                        table_name: tableName,
                        row_id: rowId
                    })
                }).then(function(oResponse) {
                    if (oResponse) {
                        console.log("Delete successful!");
                        return true;
                    }
                    throw new Error("Delete 500");
                });
            }.bind(this));
        },
    }
})