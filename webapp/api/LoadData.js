sap.ui.define([
], function () {
    "use strict";
    const SEARCH_TABLE_ACTION =   "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.SearchTables(...)";
    const LOAD_TABLE_ACTION   =   "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.LoadTable(...)";

    return {
        searchTables: function (oModel, sSearchName, sSearchDesc) {
            return new Promise(function (resolve, reject) {
                var sActionPath = SEARCH_TABLE_ACTION;
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
                var sActionPath = LOAD_TABLE_ACTION;
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
    };
});