sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "zapp/api/DeleteFromDatabase",
    "zapp/api/SaveToDatabase",
    "zapp/utils/DataFormatter",
    "zapp/utils/GridValidator",
    "zapp/utils/ValueHelp"
], function (Controller, JSONModel, fioriLibrary, DeleteFromDatabase, SaveToDatabase, DataFormatter, GridValidator, ValueHelp) {
    "use strict";

    return Controller.extend("zapp.controller.DetailData", {
        onInit: function () {
            var oOwnerComponent = this.getOwnerComponent();

            this.oRouter = oOwnerComponent.getRouter();
            this.oRouter.getRoute("DetailData").attachPatternMatched(this._onObjectMatched, this);

            var oDetailRecord = new JSONModel({ Data: [], records: [] });
            this.getView().setModel(oDetailRecord, "detailRecord");

            var oViewModel = new JSONModel({ isEditMode: false });
            this.getView().setModel(oViewModel, "viewModel");
        },

        _onObjectMatched: function (oEvent) {
            this.getView().getModel("viewModel").setProperty("/isEditMode", false);

            this._record = oEvent.getParameter("arguments").rowId || this._record || "0";
            this._tableName = oEvent.getParameter("arguments").tableName || this.getView().getModel("overall").getProperty("/tableName");

            var aData = this.getView().getModel("displayModel").getProperty("/Data");

            if (aData.length === 0) {
                var tableName = oEvent.getParameter("arguments").tableName || this._record || "";
                this.getOwnerComponent().getRouter().navTo("RouteObjectPage", {
                    layout: fioriLibrary.LayoutType.OneColumn,
                    tableName: tableName,
                    newTable: true
                }, true);
                return;
            }
            if (aData[this._record] != undefined) {
                var oDataClone = JSON.parse(JSON.stringify(aData[this._record]));
                this.getView().getModel("detailRecord").setProperty("/Data", oDataClone);

                var formatData = Object.values(oDataClone);
                var primaryKeys = formatData.filter(function (cell) {
                    if (cell && cell.keyFlag) {
                        return cell;
                    }
                });

                this.getView().getModel("detailRecord").setProperty("/title", primaryKeys[0]);
                this._loadImpactAnalysisData();
            }
        },

        onEditAction: function () {
            var oView = this.getView();
            var oDetailModel = oView.getModel("detailRecord").getProperty("/Data");

            var aCells = Object.values(oDetailModel).filter(i => typeof i === 'object' && i.uuid);
            if (aCells.length === 0) {
                sap.m.MessageBox.warning("No valid data found for editing!");
                return;
            }

            oView.getModel("viewModel").setProperty("/isEditMode", true);
        },

        onInputChange: function () {
            this._validateDetailForm();
        },

        _validateDetailForm: function () {
            var oView = this.getView();
            var oDetailModel = oView.getModel("detailRecord").getProperty("/Data");
            var aMeta = oView.getModel("displayModel").getProperty("/Meta") || [];
            var bHasError = false;

            Object.keys(oDetailModel).forEach(function (key) {
                if (!isNaN(key)) {
                    var oCell = oDetailModel[key];
                    if (oCell && oCell.fieldname) {
                        var oMetaDef = aMeta[key] || {};
                        var sDataType = oMetaDef.datatype || oMetaDef.dataType || "";
                        var iLength = parseInt(oMetaDef.leng || oMetaDef.length || 0, 10);
                        var sFN = oCell.fieldname.toUpperCase();

                        if (!sDataType || sDataType === "CHAR" || sDataType === "STRING") {
                            if (sFN.includes("DATE") || sFN === "BEGDA" || sFN === "ENDDA") {
                                sDataType = "DATS";
                            }
                        }

                        var oVal = GridValidator.checkCellFormat(oCell.value, sDataType, iLength || 255);

                        if (!oVal.valid) {
                            bHasError = true;
                            oCell._state = "Error";
                            oCell._msg = oVal.msg;
                        } else {
                            oCell._state = "None";
                            oCell._msg = "";
                        }
                    }
                }
            });

            var sStartDate = "", sEndDate = "";
            var oStartCell = null, oEndCell = null;

            Object.keys(oDetailModel).forEach(function (key) {
                if (!isNaN(key)) {
                    var oCell = oDetailModel[key];
                    if (oCell && oCell.fieldname) {
                        var sFN = oCell.fieldname.toUpperCase();
                        if (sFN === "START_DATE" || sFN === "BEGDA") {
                            sStartDate = oCell.value; oStartCell = oCell;
                        } else if (sFN === "END_DATE" || sFN === "ENDDA") {
                            sEndDate = oCell.value; oEndCell = oCell;
                        }
                    }
                }
            });

            if (sStartDate && sEndDate) {
                var dStart = new Date(sStartDate);
                var dEnd = new Date(sEndDate);
                if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime()) && dEnd < dStart) {
                    bHasError = true;
                    if (oStartCell) { oStartCell._state = "Error"; oStartCell._msg = "Must be earlier than End Date"; }
                    if (oEndCell) { oEndCell._state = "Error"; oEndCell._msg = "Must be later than Start Date"; }
                }
            }

            oView.getModel("detailRecord").refresh(true);
            return bHasError;
        },

        onSaveAction: function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oDetailModel = oView.getModel("detailRecord").getProperty("/Data");
            var tableName = this._tableName;

            if (this._validateDetailForm()) {
                sap.m.MessageBox.error("Please correct the red fields before saving!");
                return;
            }

            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsManager = oAuthModel ? oAuthModel.getProperty("/isManager") : false;
            var bIsAdmin = oAuthModel ? oAuthModel.getProperty("/isAdmin") : false;

            var oFirstCell = Object.values(oDetailModel).find(c => c && typeof c === 'object' && c.uuid);
            var enUuid = oFirstCell ? oFirstCell.uuid : "";

            if (bIsManager || bIsAdmin) {
                sap.ui.core.BusyIndicator.show(0);
                SaveToDatabase.onSaveDB(tableName, oView, [oDetailModel]).then(function () {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("Update successful!");
                    oView.getModel("viewModel").setProperty("/isEditMode", false);
                    this._updateDisplayModelAfterSave(oDetailModel);
                }.bind(this)).catch(function () {
                    sap.ui.core.BusyIndicator.hide();
                });
                return;
            }

            var aPromises = {};
            var aMeta = oView.getModel("displayModel").getProperty("/Meta") || [];

            Object.keys(oDetailModel).forEach(function (key) {
                if (!isNaN(key)) {
                    var oCell = oDetailModel[key];
                    if (oCell && oCell.fieldname) {
                        var oMetaDef = aMeta[key] || {};
                        var sDataType = oMetaDef.datatype || oMetaDef.dataType || "";
                        var sFN = oCell.fieldname.toUpperCase();

                        if (!sDataType || sDataType === "CHAR" || sDataType === "STRING") {
                            if (sFN.includes("DATE") || sFN === "BEGDA" || sFN === "ENDDA") sDataType = "DATS";
                        }
                        aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, sDataType);
                    }
                }
            });

            var codeData = DataFormatter.encodeFunction(aPromises);
            sap.ui.core.BusyIndicator.show(0);

            if (enUuid) {
                var path = "/Data(uuid=" + enUuid + ")";

                var oContextBinding = oModel.bindContext(path, null, { $$updateGroupId: "updateGroup" });
                var oContext = oContextBinding.getBoundContext();

                oContext.setProperty("table_name", tableName);
                oContext.setProperty("data", codeData);
            } 
            oModel.submitBatch("updateGroup").then(function () {
                sap.ui.core.BusyIndicator.hide();

                var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
                var bHasBackendError = aMessages.some(function (msg) {
                    return msg.type === sap.ui.core.MessageType.Error;
                });

                if (bHasBackendError || oModel.hasPendingChanges()) {

                    var sErrorText = "Update failed. Please check the data.";
                    if (aMessages.length > 0) {
                        sErrorText = aMessages[0].message;
                    }

                    sap.m.MessageBox.error(sErrorText); 
                    return;
                }

                sap.m.MessageToast.show("Request sent successfully! Please wait for Manager approval");
                this.onCancelEdit();

            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Network/System failed: " + oError.message);
            });
        },

        onCancelEdit: function () {
            var oView = this.getView();
            oView.getModel("viewModel").setProperty("/isEditMode", false);

            var aData = oView.getModel("displayModel").getProperty("/Data");
            if (aData[this._record] != undefined) {
                var oDataClone = JSON.parse(JSON.stringify(aData[this._record]));
                oView.getModel("detailRecord").setProperty("/Data", oDataClone);
            }
        },

        _updateDisplayModelAfterSave: function (oSavedData) {
            var oDisplayModel = this.getView().getModel("displayModel");
            var aData = oDisplayModel.getProperty("/Data");

            if (aData[this._record] !== undefined) {
                aData[this._record] = oSavedData;
                oDisplayModel.setProperty("/Data", aData);
                oDisplayModel.refresh(true);
            }
        },

        onRollback: function () {
            var oFCL = this.oView.getParent().getParent();
            var tableName = this._tableName;
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);

                this.getOwnerComponent().getRouter().navTo("RouteObjectPage", {
                    layout: fioriLibrary.LayoutType.OneColumn,
                    tableName: tableName,
                    newTable: false
                }, true);
            } else {
                console.error("unknown fcl id");
            }
        },

        onDeleteRow: function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oDetailModel = oView.getModel("detailRecord");
            var oDataRaw = oDetailModel.getProperty("/Data");
            var tableName = this.getView().getModel("overall").getProperty("/tableName");

            if (oDataRaw.length === 0) return;
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsClerk = oAuthModel ? oAuthModel.getProperty("/isClerk") : false;
            sap.m.MessageBox.confirm("Do you want to delete this record?", {
                onClose: function (sAction) {
                    if (sAction !== sap.m.MessageBox.Action.OK) {
                        return;
                    }
                    oView.setBusy(true);

                    var pDeleteTask = bIsClerk 
                        ? DeleteFromDatabase.onDeleteActiveRecord(tableName, oView, oDataRaw)
                        : DeleteFromDatabase.onDeleteFromDatabase(tableName, oView, oDataRaw);

                    pDeleteTask.then(function (aCells) {
                        oView.setBusy(false);
                        var sRowId = (aCells && aCells.length > 0) ? aCells[0].row_id : null;
                        this._cleanUpAfterDelete(sRowId, bIsClerk);
                    }.bind(this)).catch(function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        sap.m.MessageBox.error("This record is pending for approval.");
                        oView.setBusy(false);
                        console.error(oError);
                    });
                }.bind(this)
            });
        },

        _cleanUpAfterDelete: function (sRowId, bIsClerk) {
            var oDisplayModel = this.getView().getModel("displayModel");
            var aData = oDisplayModel.getProperty("/Data");
            var aNewData = aData.filter(function (row) {
                return !(row[0] && row[0].row_id === sRowId);
            });
            if (bIsClerk) {
                sap.m.MessageToast.show("Request sent successfully! Please wait for Manager approval!");
            } else {
                sap.m.MessageToast.show("Deleted successfully from database!");
                oDisplayModel.setProperty("/Data", aNewData);
                sap.m.MessageBox.success("Delete record " + sRowId + " successfully", {
                    title: "Successfull",
                    onClose: function () {
                        this.onRollback();
                    }.bind(this)
                });
            }
            this.getView().getModel("overall").setProperty("/count", aNewData.length);
            oDisplayModel.refresh(true);

        },

        onDynamicValueHelp: function (oEvent) {
          ValueHelp.openFieldValueHelp(this, oEvent);
        },

        onValueHelpConfirm: function (oEvent) {
            ValueHelp.confirmValueHelp(oEvent);
        },

        _loadImpactAnalysisData: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel();

            var oEmptyGraphModel = new sap.ui.model.json.JSONModel({ nodes: [], lines: [] });
            oView.setModel(oEmptyGraphModel, "graph");

            var sTableName = this._tableName;

            var oDetailData = oView.getModel("detailRecord").getProperty("/Data");
            var aCells = Object.values(oDetailData).filter(i => typeof i === 'object');

            var sKeyValue = "";
            var sUuid = "";

            if (aCells.length > 0) {
                aCells.forEach(cell => {
                    if (cell.keyFlag === true) {
                        sKeyValue = cell.value;
                    }
                });

                var oCellWithUuid = aCells.find(cell => cell.uuid);
                if (oCellWithUuid) {
                    sUuid = oCellWithUuid.uuid;
                }
            }

            if (!sTableName || !sKeyValue || !sUuid) {
                return;
            }

            var sActionPath = "/Data(uuid=" + sUuid + ")/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.getimpactanalysis(...)";
            var oActionContext = oModel.bindContext(sActionPath);

            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("key_value", sKeyValue);

            oActionContext.execute().then(function () {
                var oResult = oActionContext.getBoundContext().getObject();

                if (oResult && oResult.json_string) {
                    try {
                        var oParsedGraphData = JSON.parse(oResult.json_string);
                        var oGraphModel = new sap.ui.model.json.JSONModel(oParsedGraphData);
                        oView.setModel(oGraphModel, "graph");
                    } catch (e) {
                        console.error("Error parsing JSON Impact Analysis: ", e);
                    }
                }
            }.bind(this)).catch(function (oError) {
                console.error("Error calling Impact Analysis: ", oError);
            });
        },

        onShowChild: function (oEvent) {
            var oNode = oEvent.getSource();
            var oContext = oNode.getBindingContext("graph");
            var oRowData = oContext.getObject();

            var aEmployeeList = JSON.parse(oRowData.detaildata || "[]");

            if (aEmployeeList.length === 0) {
                return sap.m.MessageBox.warning("This table has no related data.", {
                    onClose: function (sAction) {
                        if (sAction !== sap.m.MessageBox.Action.OK) {
                            return;
                        }
                    }
                });
            }

            var fieldNames = Object.keys(aEmployeeList[0]);

            var oTable = new sap.m.Table({
                width: "650px",
                columns: fieldNames.filter(function (sName) {
                    return sName && sName.toUpperCase() !== "MANDT";
                }).map(function (sName) {
                    return new sap.m.Column({
                        header: new sap.m.Label({ text: sName })
                    });
                })
            });

            oTable.bindItems({
                path: "graph>" + oContext.getPath() + "/detailDataParsed",
                template: new sap.m.ColumnListItem({
                    cells: fieldNames.filter(function (sName) {
                        return sName && sName.toUpperCase() !== "MANDT";
                    }).map(function (sName) {
                        return new sap.m.Text({
                            text: "{graph>" + sName + "}"
                        });
                    })
                })
            });

            this.getView().getModel("graph").setProperty(oContext.getPath() + "/detailDataParsed", aEmployeeList);

            if (!this._oPopover) {

                this._oPopover = new sap.m.ResponsivePopover({
                    title: "Detail Table: " + oRowData.title,
                    contentWidth: "650px",
                    placement: "Auto"
                });
                this.getView().addDependent(this._oPopover);
            }

            this._oPopover.removeAllContent();
            this._oPopover.addContent(oTable);
            this._oPopover.openBy(oNode);
        }
    });
});