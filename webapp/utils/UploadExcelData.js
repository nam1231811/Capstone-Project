sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "zapp/utils/GridValidator"
], function (MessageToast, MessageBox, BusyIndicator, GridValidator) {
    "use strict";

    var UploadExcelData = {
        onUploadExcelPress: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            var oFile = aFiles ? aFiles[0] : null;

            if (!oFile) {
                MessageToast.show("File not found. Please try again!");
                return;
            }

            var oReader = new FileReader();
            oReader.onload = function (e) {
                var sDataURL = e.target.result;
                var sBase64String = sDataURL.split(",")[1];
                var sTableName = this.getView().getModel("overall").getProperty("/tableName");

                UploadExcelData._getPreviewData.call(this, sTableName, sBase64String);

                this.byId("excelUploader").clear();
            }.bind(this);

            oReader.readAsDataURL(oFile);
        },

        // --- HÀM 1: GỌI BACKEND LẤY JSON PREVIEW ---
        _getPreviewData: function (sTableName, sBase64String) {
            var oModel = this.getView().getModel();
            BusyIndicator.show(0);

            var sPreviewPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.previewExcel(...)";
            var oActionContext = oModel.bindContext(sPreviewPath);

            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("file_content", sBase64String);

            oActionContext.execute().then(function () {
                BusyIndicator.hide();
                var oResult = oActionContext.getBoundContext().getObject();

                if (oResult && oResult.json_string) {
                    try {
                        var sDecodedString = decodeURIComponent(escape(atob(oResult.json_string)));
                        var aParsedData = JSON.parse(sDecodedString);
                        UploadExcelData._openPreviewDialog.call(this, sTableName, aParsedData);
                    } catch (e) {
                        MessageBox.error("Preview data reading error: " + e.message);
                    }
                }
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Preview error: " + (oError.message || "Please see Console."));
            });
        },

        _openPreviewDialog: function (sTableName, aData) {
            var oView = this.getView();
            var oDisplayModel = oView.getModel("displayModel");
            var aMeta = oDisplayModel ? oDisplayModel.getProperty("/Meta") : [];

            var aOldData = oDisplayModel ? oDisplayModel.getProperty("/Data") : [];

            var oJSONModel = new sap.ui.model.json.JSONModel(aData);

            var _performFullGridValidation = function () {
                var aCurrentData = oJSONModel.getData();
                var aCleanedData = GridValidator.performLiveValidation(aCurrentData, aMeta, aOldData);
                oJSONModel.setData(aCleanedData);
            };

            var oTable = new sap.ui.table.Table({
                selectionMode: "None",
                visibleRowCount: aData.length,
                alternateRowColors: true
            });

            if (aMeta && aMeta.length > 0) {
                aMeta.forEach(function (colMeta) {
                    var sKey = colMeta.fieldname;
                    var sUpperKey = sKey.toUpperCase();
                    var sLabelText = colMeta.scrtextL || colMeta.scrtextM || colMeta.scrtextS || sKey;

                    if (sUpperKey !== "MANDT") {
                        oTable.addColumn(new sap.ui.table.Column({
                            label: new sap.m.Label({ text: sLabelText, design: "Bold" }),
                            template: new sap.m.Input({
                                value: "{" + sUpperKey + "}",
                                valueState: "{_state_" + sUpperKey + "}",
                                valueStateText: "{_msg_" + sUpperKey + "}",

                                change: function (oEvent) {

                                    _performFullGridValidation();
                                }
                            }),
                            width: "10rem",
                            autoResizable: true
                        }));
                    }
                });
            }

            oTable.setModel(oJSONModel);
            oTable.bindRows("/");

            _performFullGridValidation();

            var oScrollContainer = new sap.m.ScrollContainer({
                horizontal: true,
                vertical: true,
                width: "100%",
                height: "100%",
                content: [oTable]
            });

            var oDialog = new sap.m.Dialog({
                title: "Check data before uploading - Table " + sTableName + " (" + aData.length + " line)",
                contentWidth: "1200px",
                contentHeight: "600px",
                resizable: true,
                draggable: true,
                content: [oScrollContainer],
                buttons: [
                    new sap.m.Button({
                        text: "Confirm Upload",
                        type: "Emphasized",
                        icon: "sap-icon://upload",
                        press: function () {
                            var aCurrentData = oJSONModel.getData();
                            var bHasError = false;
                            var aCleanData = [];

                            aCurrentData.forEach(function (oRow) {
                                var oCleanRow = {};
                                for (var key in oRow) {
                                    if (key.startsWith("_state_") && oRow[key] === "Error") {
                                        bHasError = true;
                                    }
                                    if (!key.startsWith("_state_") && !key.startsWith("_msg_")) {
                                        oCleanRow[key] = oRow[key];
                                    }
                                }
                                aCleanData.push(oCleanRow);
                            });

                            if (bHasError) {
                                MessageBox.error("Please correct the faulty cells (highlighted in red) before uploading!");
                                return;
                            }

                            var sNewJsonString = JSON.stringify(aCleanData);
                            var sNewBase64String = btoa(unescape(encodeURIComponent(sNewJsonString)));

                            UploadExcelData._sendExcelToBackend.call(this, sTableName, sNewBase64String);
                            oDialog.close();
                        }.bind(this)
                    }),
                    new sap.m.Button({
                        text: "Cancel",
                        press: function () { oDialog.close(); }
                    })
                ],
                afterClose: function () { oDialog.destroy(); }
            });

            oView.addDependent(oDialog);
            oDialog.open();
        },

        _sendExcelToBackend: function (sTableName, sBase64String) {
            var oView = this.getView();
            var oModel = oView.getModel();

            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsManager = oAuthModel ? oAuthModel.getProperty("/isManager") : false;
            var bIsAdmin = oAuthModel ? oAuthModel.getProperty("/isAdmin") : false;

            BusyIndicator.show(0);

            var sActionPath = "";
            if (bIsManager || bIsAdmin) {
                sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
            } else {
                sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.uploadExcel(...)";
            }

            var oActionContext = oModel.bindContext(sActionPath);

            oActionContext.setParameter("table_name", sTableName.toUpperCase());

            if (bIsManager || bIsAdmin) {
                oActionContext.setParameter("json_data", sBase64String);
            } else {
                oActionContext.setParameter("file_content", sBase64String);
            }

            oActionContext.execute().then(function () {
                BusyIndicator.hide();

                var sSuccessMsg = (bIsManager || bIsAdmin)
                    ? "Data saved directly to Physical Database!"
                    : "Excel Uploaded successfully! Waiting for approval.";
                MessageToast.show(sSuccessMsg);

                if (typeof this._refreshData === "function") {
                    this._refreshData(sTableName);
                }
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Upload error: " + (oError.message || "Please see Console."));
            });
        }
    };

    return UploadExcelData;
});