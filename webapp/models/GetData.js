sap.ui.define([
], function () {
    "use strict";

    return {
        searchTables: function (oModel, sSearchName, sSearchDesc) {
            return new Promise(function (resolve, reject) {
                var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.SearchTables(...)";
                var oActionContext = oModel.bindContext(sActionPath);

                oActionContext.setParameter("table_name", sSearchName || "");
                oActionContext.setParameter("table_description", sSearchDesc || "");

                oActionContext.execute().then(function () {
                    var oResult = oActionContext.getBoundContext().getObject();
                    if (oResult && oResult.json_string) {
                        try {
                            var oPayload = this.decodeFunction(oResult);
                            resolve(oPayload);
                        } catch (e) {
                            reject(new Error("Error decoding JSON from Backend: " + e.message));
                        }
                    } else {
                        reject(new Error("Error: Backend did not return any data"));
                    }
                }.bind(this)).catch(function (oError) {
                    var sErrorMsg = oError.message;
                    if (oError.error && oError.error.message) {
                        sErrorMsg = oError.error.message.value || oError.error.message;
                    }
                    reject(new Error(sErrorMsg));
                });
            }.bind(this));
        },

        loadTableData: function (oModel, sTableName) {
            return new Promise(function (resolve, reject) {
                var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.LoadTable(...)";
                var oActionContext = oModel.bindContext(sActionPath);

                oActionContext.setParameter("table_name", sTableName);
                oActionContext.setParameter("table_description", "");

                oActionContext.execute().then(function () {
                    var oResult = oActionContext.getBoundContext().getObject();
                    if (oResult && oResult.json_string) {
                        try {
                            var oPayload = this.decodeFunction(oResult);
                            resolve(oPayload);
                        } catch (e) {
                            reject(new Error("Error decoding JSON from Backend: " + e.message));
                        }
                    } else {
                        reject(new Error("Error: Backend did not return any data"));
                    }
                }.bind(this)).catch(function (oError) {
                    var sErrorMsg = oError.message;
                    if (oError.error && oError.error.message) {
                        sErrorMsg = oError.error.message.value || oError.error.message;
                    }
                    reject(new Error(sErrorMsg));
                });
            }.bind(this));
        },

        decodeFunction: function (object) {
            try {
                if (object && object.json_string) {
                    var sBase64 = object.json_string;
                    var sDecodedJson = decodeURIComponent(escape(window.atob(sBase64)));
                    return JSON.parse(sDecodedJson);
                }
            } catch (e) {
                console.error("GetData [decodeFunction]", e);
                throw new Error("Lỗi decode json từ be: " + e.message);
            }
        },

        encodeFunction: function (oPayload) {
            try {
                if (oPayload) {
                    var sJsonString = JSON.stringify(oPayload);
                    // Dùng encodeURIComponent và unescape để bảo toàn tiếng Việt trước khi Base64
                    return window.btoa(unescape(encodeURIComponent(sJsonString)));
                }
            } catch (e) {
                console.error("Error [encodeFunction]", e);
                throw e;
            }
        }
    };
});