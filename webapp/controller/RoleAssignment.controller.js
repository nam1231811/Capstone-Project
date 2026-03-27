sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/layout/form/SimpleForm"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, SimpleForm) {
    "use strict";

    return Controller.extend("zapp.controller.RoleAssignment", {
        onInit: function () {
            // Chỉ giữ lại Model cho cái Form (Popup)
            var oData = {
                formData: {
                    isEditMode: false,
                    userId: "",
                    roleId: "Clerk",
                    validTo: "" // Đã thêm biến lưu ngày hết hạn
                }
            };
            var oLocalModel = new JSONModel(oData);
            this.getView().setModel(oLocalModel, "roleLocal");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true);
        },

        onSearchUser: function () {
            // 1. Lấy giá trị từ cả 2 ô
            var sQuery = this.byId("searchUser").getValue();
            var sRoleKey = this.byId("filterRole").getSelectedKey();

            var aFilters = [];

            // 2. Logic cũ của bạn: Lọc theo Username (Giữ nguyên toUpperCase)
            if (sQuery) {
                aFilters.push(new sap.ui.model.Filter("Username", sap.ui.model.FilterOperator.Contains, sQuery.toUpperCase()));
            }

            // 3. Logic mới: Lọc thêm theo Role nếu người dùng có chọn
            if (sRoleKey && sRoleKey !== "ALL") {
                if (sRoleKey === "Admin") {
                    aFilters.push(new sap.ui.model.Filter("IsAdmin", sap.ui.model.FilterOperator.EQ, true));
                } else if (sRoleKey === "Manager") {
                    aFilters.push(new sap.ui.model.Filter("IsManager", sap.ui.model.FilterOperator.EQ, true));
                } else if (sRoleKey === "Clerk") {
                    aFilters.push(new sap.ui.model.Filter("IsClerk", sap.ui.model.FilterOperator.EQ, true));
                }
            }

            // 4. Đẩy điều kiện xuống Table
            var oTable = this.byId("usersTable");
            var oBinding = oTable.getBinding("items");

            if (oBinding) {
                // Đẩy cả mảng aFilters (chứa cả điều kiện Search chữ và Role) xuống Backend
                oBinding.filter(aFilters, sap.ui.model.FilterType.Application);
            }
        },

        onOpenAssignDialog: function () {
            var oModel = this.getView().getModel("roleLocal");
            // Reset luôn cả ngày khi mở form gán mới
            oModel.setProperty("/formData", { isEditMode: false, userId: "", roleId: "Clerk", validTo: "" });
            this._openRoleDialog("Cấp Quyền Mới");
        },

        onEditRole: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext(); // Lấy từ default model (OData)
            var oRowData = oContext.getObject();
            var oModel = this.getView().getModel("roleLocal");

            // Nhận diện role hiện tại
            var sCurrentRole = "Clerk";
            if (oRowData.IsAdmin) sCurrentRole = "Admin";
            else if (oRowData.IsManager) sCurrentRole = "Manager";

            oModel.setProperty("/formData", {
                isEditMode: true,
                userId: oRowData.Username,
                roleId: sCurrentRole,
                validTo: "" // Reset ngày để người dùng có thể gia hạn quyền
            });

            this._openRoleDialog("Đổi Quyền - User: " + oRowData.Username);
        },

        _openRoleDialog: function (sTitle) {
            if (!this._oRoleDialog) {
                this._oRoleDialog = new sap.m.Dialog({
                    contentWidth: "400px",
                    content: [
                        new SimpleForm({
                            layout: "ResponsiveGridLayout",
                            labelSpanL: 4, labelSpanM: 4, emptySpanL: 1, emptySpanM: 1, columnsL: 1, columnsM: 1,
                            content: [
                                new sap.m.Label({ text: "Tài khoản", required: true }),
                                new sap.m.Input({
                                    value: "{roleLocal>/formData/userId}",
                                    placeholder: "Ví dụ: DEV-097...",
                                    enabled: "{= !${roleLocal>/formData/isEditMode} }"
                                }),

                                new sap.m.Label({ text: "Gán Quyền", required: true }),
                                new sap.m.Select({
                                    selectedKey: "{roleLocal>/formData/roleId}",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "Admin", text: "Admin (Toàn Quyền)" }),
                                        new sap.ui.core.Item({ key: "Manager", text: "Manager (Kiểm Duyệt)" }),
                                        new sap.ui.core.Item({ key: "Clerk", text: "Clerk (Nhân Viên)" })
                                    ]
                                }),

                                // ĐÃ BỔ SUNG: Ô chọn Ngày hết hạn
                                new sap.m.Label({ text: "Ngày hết hạn" }),
                                new sap.m.DatePicker({
                                    value: "{roleLocal>/formData/validTo}",
                                    valueFormat: "yyyyMMdd",         // Định dạng yyyyMMdd truyền xuống ABAP
                                    displayFormat: "dd/MM/yyyy",     // Định dạng hiển thị trên UI
                                    placeholder: "Để trống = Vô thời hạn",
                                    minDate: new Date()
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Lưu (Gán Quyền)",
                        type: "Emphasized",
                        press: this.onSaveRole.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Hủy bỏ",
                        press: function () { this._oRoleDialog.close(); }.bind(this)
                    })
                });
                this.getView().addDependent(this._oRoleDialog);
            }

            this._oRoleDialog.setTitle(sTitle);
            this._oRoleDialog.open();
        },

        onSaveRole: function () {
            var oLocalModel = this.getView().getModel("roleLocal");
            var oFormData = oLocalModel.getProperty("/formData");
            var sUserId = oFormData.userId.toUpperCase();
            var sValidTo = oFormData.validTo || "";

            if (!sUserId) {
                MessageBox.error("Vui lòng nhập Username hệ thống!");
                return;
            }

            if (sValidTo !== "") {
                var oToday = new Date();
                var sYear = oToday.getFullYear().toString();
                var sMonth = (oToday.getMonth() + 1).toString().padStart(2, '0');
                var sDay = oToday.getDate().toString().padStart(2, '0');
                var sTodayYYYYMMDD = sYear + sMonth + sDay;

                if (sValidTo < sTodayYYYYMMDD) {
                    sap.m.MessageBox.error("Lỗi: Ngày hết hạn không được nhỏ hơn ngày hiện tại!");
                    return;
                }
            }

            sap.ui.core.BusyIndicator.show(0);
            var oODataModel = this.getView().getModel();

            // 1. CHỌN HÀM THEO ROLE ĐƯỢC CHỌN TRONG COMBOBOX
            var sActionName = "";
            if (oFormData.roleId === "Admin") sActionName = "assignAdmin";
            else if (oFormData.roleId === "Manager") sActionName = "assignManager";
            else if (oFormData.roleId === "Clerk") sActionName = "assignClerk";

            // 2. TẠO ĐƯỜNG DẪN ODATA GỌI XUỐNG ACTION BACKEND
            var sActionPath = "/UserRoleList('" + sUserId + "')/com.sap.gateway.srvd.zsd_dynamic_meta.v0001." + sActionName + "(...)";
            var oActionContext = oODataModel.bindContext(sActionPath);

            // 3. GẮN THAM SỐ NGÀY HẾT HẠN QUA PARAMETER
            oActionContext.setParameter("ValidTo", sValidTo);

            // 4. THỰC THI (Hệ thống SAP sẽ tự chạy hàm BAPI_USER_ACTGROUPS_ASSIGN)
            oActionContext.execute().then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Đã gán quyền " + oFormData.roleId + " thành công cho " + sUserId + "!");

                // Cập nhật lại danh sách tự động
                this.byId("usersTable").getBinding("items").refresh();
                this._oRoleDialog.close();

            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Lỗi gán quyền: " + (oError.message || "Tài khoản không tồn tại hoặc lỗi hệ thống."));
            });
        },

        onRevokeRole: function (oEvent) {
            // Lấy ra dòng (Item) đang được bấm
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext();

            if (!oContext) {
                sap.m.MessageBox.error("Không xác định được User để gỡ quyền!");
                return;
            }

            var sUsername = oContext.getProperty("Username");

            sap.m.MessageBox.confirm("Bạn có chắc chắn muốn gỡ toàn bộ quyền của User '" + sUsername + "' không?", {
                title: "Xác nhận gỡ quyền",
                onClose: function (sAction) {
                    if (sAction === sap.m.MessageBox.Action.OK) {

                        // Gọi Action 'revokeRole' đã khai báo dưới ABAP
                        var oOperation = oContext.getModel().bindContext("com.sap.gateway.srvd.zsd_dynamic_meta.v0001.revokeRole(...)", oContext);

                        oOperation.execute().then(function () {
                            sap.m.MessageToast.show("Đã gỡ quyền thành công!");
                            oContext.refresh();
                        }).catch(function (oError) {
                            sap.m.MessageBox.error("Lỗi khi gỡ quyền: " + oError.message);
                        });
                    }
                }
            });
        }
    });
});