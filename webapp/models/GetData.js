sap.ui.define([
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Filter"
], function (FilterOperator, Filter) {
    "use strict";

    return {
        loadMeta: function (oModel, sName, sDesc, sLang) {
            var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.settable(...)";
            var oAction = oModel.bindContext(sActionPath);
             
            oAction.setParameter("table_name", sName || "");
            oAction.setParameter("table_description", sDesc || "");
            oAction.setParameter("language", sLang || "E");
            console.log(oAction);
            
            return oAction.execute().then(function () {
                var oContext = oAction.getBoundContext();
                var oResult = oContext.getObject();

                if (oResult && oResult.json_string) {
                    console.log("GetData [loadMeta]");

                    var oPayload = this.decodeFunction(oResult);
                    return oPayload;
                }else {
                    throw new Error("Không nhận được dữ liệu từ be")
                }
            }.bind(this));
        },

        decodeFunction: function (object) {
            try{
                if (object && object.json_string) {
                    var sBase64 = object.json_string;
                    var sDecodedString = escape(window.atob(sBase64));
                    var sDecodedJson = decodeURIComponent(sDecodedString);

                    var oPayload = JSON.parse(sDecodedJson);
                    console.log(oPayload);
                    return oPayload;
                }
            }catch (e) {
                console.error("GetData [decodeFunction]", e);
                throw new Error("Lỗi decode json từ be:", e.message);
            }
        },

        encodeFunction: function (oPayload) {
            try {
                if (oPayload) {
                    var sJsonString = JSON.stringify(oPayload);
                    console.log(sJsonString);
                    var sBase64 = btoa(encodeURIComponent(sJsonString).replace(/%([0-9A-F]{2})/g,
                        function toSolidBytes(match, p1) {
                            return String.fromCharCode('0x' + p1);
                        }));

                    return sBase64;
                }
            } catch (e) {
                console.error("Error [encodeFunction]", e);
                throw e;
            }
        }
    };
});