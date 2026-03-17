sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator"
], function (MessageToast, MessageBox, BusyIndicator) {
    "use strict";

    var UploadExcelData = {   
        onUploadExcelPress: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            var oFile = aFiles ? aFiles[0] : null;

            if (!oFile) {
                MessageToast.show("File could not be found. Please try again!");
                return;
            }

            var oReader = new FileReader();
            
            oReader.onload = function (e) {
                var sDataURL = e.target.result;
                var sBase64String = sDataURL.split(",")[1];
                var sTableName = this.getView().getModel("overall").getProperty("/tableName");

                UploadExcelData._sendExcelToBackend.call(this, sTableName, sBase64String);
                
                this.byId("excelUploader").clear();
                
            }.bind(this);

            oReader.readAsDataURL(oFile);
        },

        _sendExcelToBackend: function (sTableName, sBase64String) {
            var oModel = this.getOwnerComponent().getModel();
            
            if (!this._oMetaFirstContext) {
                MessageBox.error("Metadata Context information not found!");
                return;
            }

            BusyIndicator.show(0);

            var sActionName = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.uploadExcel(...)";
            var oActionContext = oModel.bindContext(sActionName, this._oMetaFirstContext);
            
            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("file_content", sBase64String);

            oActionContext.execute().then(function () {
                BusyIndicator.hide();
                MessageToast.show("Excel file uploaded successfully!");
                
                if (this._oDataBindingGoc) {
                    this._oDataBindingGoc.refresh(); 
                    
                    setTimeout(function() {
                        this._loadData(this._oDataBindingGoc).then(function() {
                            this._displayData();
                        }.bind(this));
                    }.bind(this), 500); 
                }
                
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Error loading file: " + (oError.message || "Unknown error!"));
                console.error("Upload Error Details:", oError);
            });
        }
    };

    return UploadExcelData;
});