sap.ui.define([], function () {
    "use strict";

    return {
        postDelete: function (tableName, data, sUuid) {
            var sBaseUrl = "/sap/opu/odata4/sap/zsb_dynamic_meta/srvd/sap/zsd_dynamic_meta/0001";            
            
            return this._getCsrfToken().then(function(sCsrfToken) {
                var sDeleteUrl = sBaseUrl 
                    + "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.deleteActiveRecord";

                return fetch(sDeleteUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": sCsrfToken,
                    },
                    body: JSON.stringify({
                        "table_name": tableName,
                        "data": data
                    })
                }).then(function(oResponse) {
                    if (oResponse.ok) {
                        console.log("Delete successful!");
                        return true;
                    }
                    
                    throw new Error("HTTP " + oResponse.status + " - Lỗi xóa dữ liệu từ Backend!");
                });
            }.bind(this));
        },

        _getCsrfToken: function() {
            var sBaseUrl = "/sap/opu/odata4/sap/zsb_dynamic_meta/srvd/sap/zsd_dynamic_meta/0001";
            return fetch(sBaseUrl + "/", {
                method: "HEAD",
                headers: { "X-CSRF-Token": "Fetch" }
            }).then(oResponse => {
                if (!oResponse.ok) {
                    throw new Error("Cannot fetch CSRF Token");
                }
                return oResponse.headers.get("X-CSRF-Token");
            });
        }
    };
});