/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
    e.next()

    const email = ($os.getenv("PB_SUPERUSER_EMAIL") || "").trim()
    const password = ($os.getenv("PB_SUPERUSER_PASSWORD") || "").trim()

    if (!email || !password) {
        $app.logger().warn("PB_SUPERUSER_EMAIL ou PB_SUPERUSER_PASSWORD nao definidos; sincronizacao de superuser ignorada.")
        return
    }

    try {
        const superusers = $app.findCollectionByNameOrId("_superusers")

        let superuserRecord = null
        try {
            superuserRecord = $app.findAuthRecordByEmail("_superusers", email)
        } catch (_err) {
            superuserRecord = null
        }

        if (!superuserRecord) {
            superuserRecord = new Record(superusers)
        }

        superuserRecord.set("email", email)
        superuserRecord.set("password", password)
        $app.save(superuserRecord)
    } catch (err) {
        $app.logger().error("Falha ao sincronizar superuser via hook.", "error", err)
    }
})